import Fastify from "fastify";
import createUser from "../services/create_user_service.js";
import User from "../models/user.js";
import {startCronJob} from "../jobs/cron_job_retry_service.js";
import {cleanupAllJobs, enqueueJob, queue} from "../jobs/job_service.js";
import TranscriptRequest from "../models/transcript_request.js";
import AudioChunk from "../models/audio_chunk.js";

// TODO High Level
// this should truly be its own server deployment
// all of these apis should have testing, load balancing


// TODO This should be a flow type or graphQL type.
function prepareTranscriptResult(records, transcript, texts) {
    const chunkStatuses = records.reduce((result, record) => {
        result[record.file_name] = record.status;
        return result;
    }, {});
    return {
        chunkStatuses: chunkStatuses,
        // TODO: based on chunk status and assuming sorted order,
        //  I could join text and let User know where we were not able to transcribe.
        status: transcript.status,
        transcriptText: texts.join(' '),
        completed: transcript.completed_time
    }
}

// TODO fix all the console logging, debugging, development properties
const configureATSServer = async () => {
    await startCronJob();
    const server = Fastify({
        logger: true,
    })

    /* Gets all users
    TODO
    - abstract user objects away from API
    - error handling
     */
    server.get("/get-users", async function handler(request, reply) {
        const allUsers = await User.findAll();
        console.log(allUsers.map(user => user.toJSON()));
    });


    // Creates a single user
    // TODO - dynamic user creation & error handling
    server.get("/create-user", async function handler(request, reply) {
        await createUser();
    });

    /* transcribes audio chunks
     Usage: curl -X POST -H "Content-Type: application/json" -d
     '{"audio_chunk_paths": ["audio-file-2.wav", "audio-file-3.wav", ], "userId": 1}'  http://127.0.0.1:4000/transcribe

     TODO (high prio)
     - error handling, sanitization

      TODO (lower prio)
    - UI with drop down selection for audio wav files
     */
    server.post("/transcribe", async (request, reply)  => {
        const { audio_chunk_paths, userId } = request.body;
        console.log(audio_chunk_paths)
        enqueueJob({ message: 'Queueing up job data', retryCount: 0, timestamp: new Date().toISOString(),
            audio_chunk_paths: audio_chunk_paths || [] , userId: userId})
            .then(() => {
                console.log("Job Enqueue")
            }).catch(() => {
            console.log("Job Failed")
        })
        reply.send({ message: `Processing transcript for job ${userId}` });
    });

    /* Gets a job's transcription result.
    Example Usage: http://127.0.0.1:4000/transcript/18
     Returns all the transcript, the audio statuses and paths, when job was completed, job status

     TODO (high prio)
     - sanitization and error handling
     - move query logic away from ATS server
     - this needs to be super fast, so could use a nosql if needed for the transcript
     */
    server.get('/transcript/:jobId', async function handler(request, reply) {
        const jobId = parseInt(request.params.jobId);
        const records = await AudioChunk.findAll({ where: { job_id: jobId } });
        const texts = records.map(record => record.text);
        const transcript = await TranscriptRequest.findByPk(jobId);
        return prepareTranscriptResult(records, transcript, texts);
    });


    // Just a way to clean the job queue
    server.get("/clean-up-job", async function handler(request, reply) {
        await cleanupAllJobs()

    });


    /* Gets all jobs for user id.
    Returns all the transcripts, the audio statuses, when they were completed, job statuses
    Example Usage: http://127.0.0.1:4000/transcript/search?jobStatus=complete&userId=1

    TODO (high prio)
    - sanitization and error handling
     - move query logic away from ATS server
     - preloading the transcripts and paginating them
     - leveraging the right associations in these queries
     - this needs to be super fast, so could use a nosql if needed for the transcript
     */
    server.get("/transcript/search", async function handler(request, reply) {
        const { jobStatus, userId } = request.query;
        const parsedUserId = parseInt(userId);
        console.log(jobStatus)
        const transcripts = await TranscriptRequest.findAll({
            where: {
                status: jobStatus,
                user_id: parsedUserId,
            },
        });
        const transcriptIds = transcripts.map(transcript => parseInt(transcript.job_id));
        let records =[]
        if (transcripts.length > 0) {
            records = await AudioChunk.findAll({
                where: {
                    job_id: transcriptIds
                },
            });
        }
        const transcriptResults = [];
        for (const transcript of transcripts) {
            // Hacky
            const transcriptRecords = records.filter(record =>
                record.job_id === parseInt(transcript.dataValues.job_id));
            const texts = transcriptRecords.map(record => record.text);
            const transcriptResult = prepareTranscriptResult(transcriptRecords, transcript, texts);
            transcriptResults.push(transcriptResult);
        }
        console.log(transcriptResults)
        return transcriptResults
    });

    return server

}
export default configureATSServer;