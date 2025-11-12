import React from 'react';

const Footer = () => {
    return (
        <footer className="bg-gray-800 text-white py-4">
            <div className="container mx-auto text-center">
                <p>&copy; {new Date().getFullYear()} Gnomeville. All rights reserved.</p>
                <p>Follow us on social media!</p>
            </div>
        </footer>
    );
};

export default Footer;