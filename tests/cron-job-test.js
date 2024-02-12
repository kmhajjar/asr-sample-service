/*
worker():
- Make sure you stop running cron job after 1 (configurable) failed attempt
- Test that startCronJob gets called every X min
- Test optimistic locking mechanism via versions
- Test if there's failures in transcription, that we don't update anything
- Test if there's no failures we update both AudioChunks and the Transcript
- Test that upon rate limit and regular errors we catch errors


enqueue()
- Test we only enqueue the failed audio chunks for the last 24 hours
- Test that no abandoned jobs get queued up
- Test the right jobs for the right job type on the right queue get queued up

 */