/*
ATS

    prepareTranscriptResult()
        - Test: empty records
        - Test: empty text
        - Test: sorted order of audio chunks

    configureATSServer()
        - cronJob gets instantiated
        - getUsers() returns users
        - createUser() creates a new dynamic user, finds one if it already exists
        - transcribe()
             - transcribe enqueues a job and returns it in 15s (mock the response of the ASR if you need to)
             - ensure query to load up data is <1s
             - when multiple jobs are enqueued, it handles gracefully
             - if its a partial success, transcribes gives back the right statuses on all the audio chunks
             - if all chunks fail then all statuses indicate failure, but retry happens
             - if enqueue job fails entirely error is shown


        - transcript/job
            - bad data is handled gracefully
            - returns data for job that exists
            - handles error when job does not exist
            - handles 0 transcripts and audio chunks found


        - search
            - handles errors with the find all gracefully
            - checks against bad data
            - handles 0 transcripts and audio chunks found



ASR - TODO


 */