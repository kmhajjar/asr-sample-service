
import { DataTypes } from 'sequelize';

import sequelize from '../sequelize.js';

// TODO need indexes and proper assocs. FK for user_id, assoc. to AudioChunk
const TranscriptRequest = sequelize.define('TranscriptRequest', {
    job_id: {
        type: DataTypes.BIGINT,
        allowNull: false,
        primaryKey: true,
        autoIncrement: true,
    },
    user_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    total_num_file_names: { // Helpful reference field
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    total_audio_chunk_size: { // For splitting jobs across workers and concurrently if needed.
        type: DataTypes.INTEGER,
        allowNull: false,
        // calculate is 24MB for a big file (implies its 120m transcript, containing 24 chunks)
    },
    completed_time: {
        type: DataTypes.TIME,
    },
    version: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        allowNull: false,
    },
    status: {
        type: DataTypes.ENUM('complete', 'not_started', 'processing', 'retry', 'failed', 'abandoned'),
        defaultValue: 'not_started',
        allowNull: false,
    }
},
    {
        timestamps: true, // Add createdAt and updatedAt
        underscored: true,
    });


export default TranscriptRequest;