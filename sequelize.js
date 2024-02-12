// sequelize.js

import { Sequelize } from 'sequelize';

const sequelize = new Sequelize({
    dialect: 'postgres',
    username: 'postgres',
    password: 'development',
    database: 'ats', // audio transcription service
    host: 'localhost',
});

export default sequelize;