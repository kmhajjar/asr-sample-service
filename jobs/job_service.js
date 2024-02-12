/*
this file would normally be a job scheduler instantied upon start up and it would enqueue a bunch of jobs
 */

import {Queue, Worker} from 'bullmq';
import createTranscriptRequest from "../services/create_transcript_request_service.js";
import AudioChunk from "../models/audio_chunk.js";
import TranscriptRequest from "../models/transcript_request.js";
import { updateAudioChunksAndTranscript} from "../services/update_audio_chunk_service.js";
import {transcribeAudioChunks} from "../clients/asr-client.js";


const queue = new Queue('jobQueue') // main queue
;
const MAX_RETRIES_FOR_JOB = 2; // This is arbitrarily set to 2


/*
This instantiates a single worker that processes the job. Remember to run the redis server with redis-server
This has a throttler so that if there's multiple jobs we actually don't process them, because we know that 6*2 = 12
and most likely this will fail. On average, we know that it'll take 5-10 seconds for the transcripts to go through so 5
should be optimistically enough.

TODO (higher prio)
I have 1 worker right now but it would be cool if I calculated the dynamic number of queued up jobs
in the enqueue function

    const totalWorkers = await queue.getJobCounts();

Then I could instantiate as many concurrent workers as necessary. But since the rate limit on ASR still exists,
I would make sure each worker (let's say there is 10) do 10% of the work. Effectively load balancing.
 So 1 chunks per provider get processed. This would be important because then 1000 providers
 could be get feedback quicker on their uploads but then behind the scenes we'd retry failed attempts until we
 transcribed all the chunks.


TODO (lower prio)
- this function should split audio paths if >= 10 because
we know that it is max number of concurrent reqs. For example, if there's 24 audio chunks,
we can split the job into 2. We should have a separate process to findOrCreate the transcriptRequest
- make magic numbers and strings constants, especially the connection strings
- Store retry IDs upon queue.add('retry job') for better observability
 */
const worker = new Worker(
    'jobQueue',
    async (job) => {
        const { audio_chunk_paths, retryCount, parentJobId, userId} = job.data;

        try {
            let transcriptRequest;
            if (retryCount === 0) { // distinguish parent job
               const data = {total_num_file_names: audio_chunk_paths.length,
                    user_id: userId,  total_audio_chunk_size: 100}
                 transcriptRequest = await createTranscriptRequest(data)
                console.log('New transcriptRequest created:', transcriptRequest);
            }
            else {
                transcriptRequest = await TranscriptRequest.findByPk(parentJobId);
                console.log('Found transcriptRequest :', transcriptRequest)
            }

            // Returns successful, failed
            const responses = await transcribeAudioChunks(audio_chunk_paths, worker);
            // Complete or Partial Success:
            const failedSubparts = responses[1]
            const successfulSubparts = responses[0]

            // Update the DB with the results with progress so far
            await updateAudioChunksAndTranscript(successfulSubparts, failedSubparts, transcriptRequest, audio_chunk_paths);

            // TODO custom way if we want
            const delay = Math.min(1000 * Math.pow(2, job.attemptsMade), 1000);
            // If there are failed subparts, retry the job with only the failed subparts
            if (failedSubparts.length > 0 && retryCount <= MAX_RETRIES_FOR_JOB) {
                console.log('Retrying job with failed subparts on the next attempt: ', failedSubparts,
                    ` with delay ${delay} in ms`);
                await queue.add('retry job', { retryCount: retryCount + 1, audio_chunk_paths: failedSubparts,
                    parentJobId: transcriptRequest.job_id  }, {  attempts: 3,
                    backoff: {
                        type: 'exponential',
                        delay: 1000,
                     }});
            }
            else {
                console.log("Too many retries. CRON job will pick it up instead")
                return Promise.reject(new Error(`Too many retries for ${transcriptRequest.job_id}. CRON job will pick it up instead`));
            }
            const jobId = retryCount !== 0 ? parentJobId : transcriptRequest.job_id;
            // Return results for all successfully processed sub-parts to be transcriber
            return [successfulSubparts,jobId];
        } catch (error) {
            // Handle other errors for the entire job
            console.error('Error processing job:', error);
            return Promise.reject(error);
        }
    },
    {
        connection: { host: '127.0.0.1', port: 6379 },
        limiter: {
            max: 1,
            duration: 5000, // throttle at the worker level, so there shouldn't be any
        },
        concurrency: 1,
    }
);



/*
Mostly for debug methods, just helps me see the job's status
 */
worker.on('completed', async (job, return_value) => {
        // load up full transcript
        const records = await AudioChunk.findAll({where: {job_id: return_value[1]}})
        console.log(`Job ${job.id} completed successfully. Return value:`, records);
        const texts = records.map(record => record.text);
        // Use join to concatenate the texts into a single string
        const concatenated_texts = texts.join(' ')
        console.log(`Job ${job.id} completed successfully. Return value:`, concatenated_texts);
    }
);

worker.on('failed', (job, return_value) => {
    console.log(`Job ${job.id} failed. Return value:`, return_value);
    return return_value
});

worker.on('progress', (job, return_value) => {
    // could be cool to see the "so-far" stitched up transcript
    return return_value
});

worker.on('error', err => {
    // log the error
    console.error(err);
});


async function enqueueJob(jobData, options) {
    await queue.add('regular_job', jobData, options);
}


async function cleanupAllJobs() {
    const result = await queue.clean(0, 'completed', 'failed',
        'delayed', 'waiting', 'active', 'paused', 'stalled');
    console.log(`Cleaned ${result} jobs.`);
}


export { worker, queue, enqueueJob , cleanupAllJobs};








