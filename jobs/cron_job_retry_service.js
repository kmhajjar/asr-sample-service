import {Queue, Worker} from 'bullmq';
import cron from 'node-cron';
import AudioChunk from "../models/audio_chunk.js";
import TranscriptRequest from "../models/transcript_request.js";
import {Op} from "sequelize";
import sequelize from "../sequelize.js";
import {transcribeAudioChunks} from "../clients/asr-client.js";
import {updateAudioChunksAndTranscript} from "../services/update_audio_chunk_service.js";

const retryQueue = new Queue('jobQueueCron');

/*
This is the CRON job retry service in case of server restarts, among other issues.
Tries to reprocess old jobs that aren't complete.

TODO (highest prio)
- Optimistic Locking.
I don't have this implemented yet but I need this to make sure that I don't have data consistency problems
writing to the same 2 tables
- I have the cron job looking at the last 24 hour jobs but really I'd want the last 1 hour
 potentially to cover any inconsistencies with the last 2 shifts
- Once I add proper associations for TranscriptRequest & AudioChunk, I want to preload the queries and join them beforehand.


TODO (lower prio)
-  Bring in the same logic as job_service for retries. Right now we're just trying once then giving up on the job.
Update madeAttempts for reties
- I'd have different cron job scheduler in production. For demo purposes, it'd be every minute. In production,
I'd want this to maximize NOT conflicting with the clinic's 30 minute shifts.
- Same set up TODOs for the worker as in job_service (e.g connection strings, worker options, console log clean up )
- Preloading.
 */
const worker = new Worker(
    'jobQueueCron',
    async (job) => {
        try {
            const {audio_chunk_paths, jobId} = job.data;
            const transcriptRequest = await TranscriptRequest.findByPk(jobId);
            const responses = await transcribeAudioChunks(audio_chunk_paths, worker);
            // Skipping failed parts for now
            const failedSubparts = responses[1]
            const successfulSubparts = responses[0]
            // TODO : short cut, just error out if there's any failed ones
            if (failedSubparts.length > 0) {
                console.error('At least one sub part failed, abandoning this job');
                await transcriptRequest.update({ status: 'abandoned'}); // Stop processing the job
                return Promise.reject(new Error());
            }
            else {
                await updateAudioChunksAndTranscript(successfulSubparts, failedSubparts, transcriptRequest, audio_chunk_paths);
            }

            return [successfulSubparts, jobId];
        }
        catch (error) {
            // Handle other errors for the entire job
            console.error('Error processing job:', error);
            return Promise.reject(error);
        }
    },
    {
        connection: { host: '127.0.0.1', port: 6379 },
        limiter: {
            max: 1,
            duration: 5000, // Same throttling
        },
        concurrency: 1,
    }
    )

    export async function startCronJob() {
        // Schedule a cron job
        cron.schedule('*/1 * * * *', async () => {
            return await retryFailedJobs();
        });
    }

    async function retryFailedJobs() {
        const currentDate = new Date();
        const twentyFourHoursAgo = new Date(currentDate - 24 * 60 * 60 * 1000);
        const timestampRange = {
            [Op.gte]: twentyFourHoursAgo,
            [Op.lte]: currentDate,
        };

        // This try block changes a lot if I set the DB up properly and do createOrUpdates.
        try {
            const failedRequestsIds = await TranscriptRequest.findAll({
                attributes: ['job_id'], where: {
                    createdAt: timestampRange,
                    status: {
                        [Op.notIn]: ['complete', 'abandoned'],
                    },
                }
            })
            const failedRequestIdsArray = failedRequestsIds.map(transcriptRequest => transcriptRequest.job_id);
            const failedUniqueFileNames = await AudioChunk.findAll({
                attributes: [[sequelize.fn('DISTINCT',
                    sequelize.col('file_name')), 'unique_file_name'], 'job_id'],
                // only because I don't want to create dupe records
                where: {
                    status: 'failed',
                    job_id: failedRequestIdsArray
                },
                group: ['job_id', 'id'],
            });
            const fileByJob = failedUniqueFileNames.reduce((result, chunk) => {
                const jobId = chunk.dataValues.job_id;
                result[jobId] = [chunk.dataValues.unique_file_name];
                return result;
            }, {})
            console.log(fileByJob)
            for (const [key] of Object.entries(fileByJob)) {
                console.log(`Key: ${key}, Value: ${fileByJob[key]}`);
                // TODO make this smarter
                await retryQueue.add('retry-job', {audio_chunk_paths: fileByJob[key], jobId: key});
            }
        }
        catch (error) {
            console.error('Error queueing job:', error);
        }
    }



