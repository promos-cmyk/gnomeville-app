import React from 'react';
import Tabs from '../components/Tabs';
import Participant from './Participant';
import PartnerBidding from '../components/PartnerBidding';

function PartnerPushClue(){
    return (
        <div className="p-3 border rounded bg-yellow-50 text-sm">Partner push clue / instructions go here.</div>
    );
}

const Home = () => {
        const [tab, setTab] = React.useState('participant');

        return (
                <div className="p-6">
                        <Tabs tab={tab} setTab={setTab} />

                        {tab==='participant' && (
                            <div className="mt-6">
                                <Participant />
                            </div>
                        )}

                        {tab==='partners' && (
                            <div className="space-y-4 mt-6">
                                <PartnerBidding />
                                <PartnerPushClue />
                            </div>
                        )}

                        {tab==='admin' && (
                            <div className="mt-6">Admin area (restricted)</div>
                        )}
                </div>
        );
};

export default Home;