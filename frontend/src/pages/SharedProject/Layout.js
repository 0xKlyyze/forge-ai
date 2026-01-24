import React from 'react';
import { useParams } from 'react-router-dom';
import ProjectLayout from '../Project/Layout';

export default function SharedProjectLayout() {
    const { token } = useParams();
    // Wrap ProjectLayout to provide token and readOnly mode
    // ProjectLayout will handle fetching data via ProjectProvider using the token
    return <ProjectLayout token={token} readOnly={true} />;
}
