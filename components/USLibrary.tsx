import { useEffect, useState } from "react";
import type { Web3Provider } from "@ethersproject/providers";
import { useWeb3React } from "@web3-react/core";
import CircularProgress from '@mui/material/CircularProgress';
import Box from '@mui/material/Box';
import toastr from 'toastr';

import useUSElectionContract from "../hooks/useUSElectionContract";
import { formatEtherscanLink, shortenHex } from "../util";

type USContract = {
  contractAddress: string;
};

enum President {
  BIDEN = 1,
  TRUMP = 2
}

export enum Leader {
  UNKNOWN,
  BIDEN,
  TRUMP
}

const USLibrary = ({ contractAddress }: USContract) => {
  const { account, library, chainId } = useWeb3React<Web3Provider>();
  const usElectionContract = useUSElectionContract(contractAddress);
  const [currentLeader, setCurrentLeader] = useState<string>('Unknown');
  const [name, setName] = useState<string | undefined>();
  const [votesBiden, setVotesBiden] = useState<number | undefined>();
  const [votesTrump, setVotesTrump] = useState<number | undefined>();
  const [stateSeats, setStateSeats] = useState<number | undefined>();
  const [isLoading, setLoading] = useState<boolean>(false);
  const [hash, setTxHash] = useState<string>();
  const [bidenSeats, setBidenSeats] = useState<number>(0);
  const [trumpSeats, setTrumpSeats] = useState<number>(0);
  const [electionState, setElectionState] = useState<string>();

  useEffect(() => {
    getElectionState();
    getCurrentSeats();
    getCurrentLeader();
  }, [])

  const getCurrentLeader = async () => {
    const currentLeader = await usElectionContract.currentLeader();

    setCurrentLeader(currentLeader == Leader.UNKNOWN ? 'Unknown' : currentLeader == Leader.BIDEN ? 'Biden' : 'Trump')
  }

  const stateInput = (input) => {
    setName(input.target.value)
  }

  const bideVotesInput = (input) => {
    setVotesBiden(input.target.value)
  }

  const trumpVotesInput = (input) => {
    setVotesTrump(input.target.value)
  }

  const seatsInput = (input) => {
    setStateSeats(input.target.value)
  }

  const submitStateResults = async () => {
    try {
      if (!votesBiden || !votesTrump || !stateSeats || !name) {
        toastr.warning('All fields required!');
        return;
      }
      if (votesBiden === votesTrump) {
        toastr.warning('There cannot be a tie!');
        return;
      }

      const result: any = [name, +votesBiden, +votesTrump, +stateSeats];
      const tx = await usElectionContract.submitStateResult(result);

      setLoading(true);
      setTxHash(tx.hash);

      await tx.wait();

      setLoading(false);
      setTxHash('');
      getCurrentLeader();
      getCurrentSeats();
      resetForm();

      toastr.success('State submited successfully!');

    } catch (err) {
      toastr.error(err.message);
    }
  }

  const getCurrentSeats = async () => {
    const bidenSeats = await usElectionContract.seats(Leader.BIDEN);
    const trumpSeats = await usElectionContract.seats(Leader.TRUMP);

    setBidenSeats(bidenSeats);
    setTrumpSeats(trumpSeats);
  }

  const getElectionState = async () => {
    const election = await usElectionContract.electionEnded();

    setElectionState(election ? 'Ended' : 'In progress');
  }

  const endElection = async () => {
    try {
      usElectionContract.on('LogElectionEnded', (winner: number, stateSeats: number, state: string, tx: any) => {
        console.log('EVENT EMITTED: ', { winner, stateSeats, state });

      });
      const tx = await usElectionContract.endElection();

      setLoading(true);

      await tx.wait();

      setLoading(false);
      getElectionState();

      toastr.success('Election ended!');
    } catch (err) {
      toastr.error(err.message);
    }
  }

  const resetForm = async () => {
    setName('');
    setVotesBiden(0);
    setVotesTrump(0);
    setStateSeats(0);
  }

  return (
    <div className="results-form">
      {isLoading
        ? <div>
          <Box sx={{ display: 'absolute' }}>
            <CircularProgress />
          </Box>
          <a
            {...{
              href: formatEtherscanLink("Transaction", [chainId, hash]),
              target: "_blank",
              rel: "noopener noreferrer",
            }}
          >
            {hash}
          </a>
        </div>
        : ''
      }
      <div>
        <p>
          Biden Seats: {bidenSeats}
        </p>
        <p>
          Trump Seats: {trumpSeats}
        </p>
      </div>
      <p>
        Current Leader is: {currentLeader}
      </p>
      <p>
        Election State: {electionState}
      </p>
      <form>
        <label>
          State:
          <input onChange={stateInput} value={name} type="text" name="state" />
        </label>
        <label>
          BIDEN Votes:
          <input onChange={bideVotesInput} value={votesBiden} type="number" name="biden_votes" />
        </label>
        <label>
          TRUMP Votes:
          <input onChange={trumpVotesInput} value={votesTrump} type="number" name="trump_votes" />
        </label>
        <label>
          Seats:
          <input onChange={seatsInput} value={stateSeats} type="number" name="seats" />
        </label>
        {/* <input type="submit" value="Submit" /> */}
      </form>
      <div className="button-wrapper">
        <button disabled={isLoading} onClick={submitStateResults}>Submit Results</button>
      </div>
      <div className="button-wrapper">
        <button disabled={isLoading} onClick={endElection}>End Election</button>
      </div>
      <style jsx>{`
        .results-form {
          display: flex;
          flex-direction: column;
        }

        .button-wrapper {
          margin: 20px;
        }
        
      `}</style>
    </div>
  );
};

export default USLibrary;
