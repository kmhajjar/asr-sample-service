import TranscriptRequest from "../models/transcript_request.js";
import AudioChunk from "../models/audio_chunk.js";



/*
Takes in successful and failed transcription chunks.
Updates TranscriptRequest & AudioChunks for partial transcriptions & complete transcriptions

TODO
- handle versioning for optimistic locking
- handle locks on tables
- name this file differently -- maybe split into audioService and transcriptService, split complete from partial
 */
export async function updateAudioChunksAndTranscript(successful, failed, transcriptRequest,  audio_chunk_paths) {
    // Complete update
    if (successful.length === audio_chunk_paths.length) {
        return await insertAndUpdate(successful, audio_chunk_paths, transcriptRequest, 'complete')
    }
    // Partial update
    if (successful.length > 0) {
        const data = successful.map(result => {
            return {
                job_id: transcriptRequest.job_id, user_id: transcriptRequest.user_id,
                file_name: result.path, size: 1, text: result.transcript, status: 'complete'
            }
        })
        const failedData = failed.map(subpart => {
            return {
                job_id: transcriptRequest.job_id, user_id: transcriptRequest.user_id,
                file_name: subpart, size: 1, status: 'failed'
            }
        })
        // update successful data and failed data
        return await insertAndUpdate(data.concat(failedData), audio_chunk_paths, transcriptRequest, 'processing')
    }
}


/*
This inserts the list of audioChunks and updates
the corresponding transcript request with the right status/complete time.


TODO (high prio)
- stop batch creating. we need to batch update because I created dupe records for updates
- Upon (status === 'complete'), is when I would send a message to noSQL DB with full transcript in production ready sys.
- handle roll backs
 */
async function insertAndUpdate(data, audio_chunk_paths, transcriptRequest, status) {
    try {
        await AudioChunk.sync();
        await AudioChunk.bulkCreate(data);
        console.log('Batch insert successful');
        // Check if we processed every single chunk
        // Update transcriptRequest status to 'complete' in happy path
            await TranscriptRequest.sync();
            if (status === 'complete') { // Should load the enum not the constant
                const currentTimestamp = new Date().toISOString();
                await transcriptRequest.update({ status: status, completed_time: currentTimestamp});
            }
            else {
                await transcriptRequest.update({ status: status});
            }

    } catch (error) {
        console.error('Error during batch insert:', error);
    }
}


