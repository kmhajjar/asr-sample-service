import TranscriptRequest from "../models/transcript_request.js";


// Should be find or create
async function createTranscriptRequest(data) {
    try {
        await TranscriptRequest.sync(); // Sync the model with the database
        const transcriptRequest = await TranscriptRequest.create(
            data
        );
        console.log('New transcript created:', transcriptRequest);
        return transcriptRequest
    } catch (error) {
        console.error('Error syncing database and creating transcript request:', error);
    }
}

export default createTranscriptRequest