import React from 'react';

const Profile = () => {
    // Placeholder for user profile data
    const user = {
        name: 'John Doe',
        email: 'john.doe@example.com',
        bio: 'A brief bio about John Doe.',
    };

    return (
        <div className="max-w-md mx-auto mt-10 p-5 border rounded-lg shadow-lg">
            <h1 className="text-2xl font-bold mb-4">User Profile</h1>
            <div className="mb-2">
                <strong>Name:</strong> {user.name}
            </div>
            <div className="mb-2">
                <strong>Email:</strong> {user.email}
            </div>
            <div>
                <strong>Bio:</strong> {user.bio}
            </div>
        </div>
    );
};

export default Profile;