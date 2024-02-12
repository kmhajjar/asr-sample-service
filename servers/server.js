
/*
Normally these servers would be deployed separately
 */
import configureASRServer from './asr-server.js';
import configureATSServer from './ats-server.js';

(async () => {
    const server = await configureASRServer()
    const serverATS = await configureATSServer();

    // TODO this is deprecated, so fix.
    server.listen(3001, () => {
        console.log('ASR-server listening on port 3000');
    });

    serverATS.listen(4000, () => {
        console.log('ATS-server listening on port 4000');
    });
})();


