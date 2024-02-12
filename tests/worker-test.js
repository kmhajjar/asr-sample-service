// Test Cases and / or Manual Tests


/*
At a minimum:

worker():
- verify the rollbacks in each case and the array sizes
    Test Case 1: if createTranscriptRequest fails, retry
    Test Case 2: if findTranscriptRequest fails, retry (but only if < MAX)
    Test Case 3: if transcribeAudioChunks stops execution
    Test Case 4: if transcribeAudioChunks succeeds completely
    Test Case 5: if transcribeAudioChunks has partial complete
    Test Case 6: if transcribeAudioChunks has completely failed
    Test Case 7: if updateAudioChunksAndTranscript fails,
    should retry/rollback transcriptRequest
    Test Case 8: if originalJob has been retries beyond the MAX, we should get the CronJob notification
    Test Case 9: if there's a regular error or rollback we
    attempt retry up until MAX
    Test Case 10: test the exp. backoff
    Test Case 11:  multiple jobs get queued up at the same time, should be processed 5s apart

worker.complete(), failed, progress basic tests

enqueueJob()
- job gets queued with the right type and job data

 */