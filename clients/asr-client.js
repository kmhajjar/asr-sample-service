import axios from "axios";
import {Worker} from "bullmq";

/*
Makes a request to the ASR Server.
Serves as "barebones" function that would represent client request.

Input: AudioPath
Output: an array containing the data, whether  [text, false, 0]


TODO (low prio)
- base urls based on properties
- make subpart a constant and not inject
- fix log levels
 */
async function makeAsrRequest(audioPath) {
    try {
        // Make a request to the ASR server
        const response = await axios.get(`http://localhost:3000/get-asr-output?path=${audioPath}`);
        console.log(response.data)
        return response.data

    } catch (error) {
        if (error.response && error.response.status === 429) {
            // Handle rate limiting
            console.log("rate limit hit: ", error.response.status)
            return Promise.reject(new Worker.RateLimitError());

        } else {
            // Handle other errors
            console.error('Error making request to ASR server:', error.message);
            return Promise.reject(new Error("Generic Error"));

        }
    }
}

/*
This function parallelizes each audio chunk to the max amount of workers.
TODO (med prio)
- optimization: make sure that the audio chunk paths is less than 10
 */
export async function transcribeAudioChunks( audio_chunk_paths, worker) {
    const results = [];
    const failedSubparts = []
    await Promise.all(
        audio_chunk_paths.map(async (subpart) => {
            try {
                const result = await makeAsrRequest(subpart);
                results.push(result);
            } catch (error) {
                console.error('Adding failed instance to the failedSubparts array', error.message);
                failedSubparts.push(subpart);
            }
        }));
    return [results, failedSubparts]
}


