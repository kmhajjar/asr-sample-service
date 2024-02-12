import User from "../models/user.js";


async function createUser() {
    try {
        await User.sync(); // Sync the model with the database
        const newUser = await User.create({
            user_id: 1,
        });
        console.log('New user created:', newUser.toJSON());
    } catch (error) {
        console.error('Error syncing database and creating user:', error);
    }
}

export default createUser;