import React, { useState, useEffect, createContext, useContext } from 'react';
import { ApolloClient, InMemoryCache, gql, useMutation, createHttpLink } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';
import { removeTypenameFromVariables } from '@apollo/client/link/remove-typename';
import { Lucid } from 'lucid-cardano';

const LucidContext = createContext(null);

// Custom hook for managing Lucid state
const useLucid = () => {
  const [lucid, setLucid] = useState(null);
  const [walletAddress, setWalletAddress] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState(null);

  const initializeLucid = async () => {
    try {
      const lucidInstance = await Lucid.new();
      const api = await window.cardano.yoroi.enable();
      lucidInstance.selectWallet(api);
      const address = await lucidInstance.wallet.address();
      
      setLucid(lucidInstance);
      setWalletAddress(address);
      setIsConnected(true);
      setError(null);
      
      return { lucidInstance, address };
    } catch (err) {
      setError(err.message);
      setIsConnected(false);
      console.error('Wallet connection failed:', err);
      throw err;
    }
  };

  return {
    lucid,
    walletAddress,
    isConnected,
    error,
    initializeLucid
  };
};

// HTTP link for GraphQL endpoint
const httpLink = createHttpLink({
  uri: 'http://localhost:3000/graphql', // Replace with your GraphQL endpoint
});

// Set up the authorization header
const authLink = setContext((_, { headers }) => {
  const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjUsInVzZXJuYW1lIjpudWxsLCJodHRwczovL2hhc3VyYS5pby9qd3QvY2xhaW1zIjp7IngtaGFzdXJhLWFsbG93ZWQtcm9sZXMiOlsiYWRtaW4iLCJ1c2VyIiwiYnJhbmQiXSwieC1oYXN1cmEtZGVmYXVsdC1yb2xlIjoidXNlciIsIngtaGFzdXJhLXVzZXItaWQiOiI1In0sImlhdCI6MTczMzE1MDU3MywiZXhwIjoxNzMzMTUwODczLCJpc3MiOiJpc3N1ZXIucHJvZmlsYS5jb20ifQ.SpCwFGLe60RxzJbVy5SpxBPeOYWn5dkNdmln6nTDdhM' // Replace with your token retrieval logic
  return {
    headers: {
      ...headers,
      authorization: token ? `Bearer ${token}` : '',
    },
  };
});


// Combine authLink and httpLink
const client = new ApolloClient({
  link: removeTypenameFromVariables().concat(authLink).concat(httpLink),
  cache: new InMemoryCache(),
});

console.log('client: ', client)


// Define GraphQL mutations
const MUTATION_ONE = gql`
  mutation initSubscriptionNFTCreate(
    $input: SubscriptionDto!
  ){
    initSubscriptionNFTCreate(
      input: $input
    ){
      subscription {
        nftEntropyRef {
          input {
            outputIndex
            txHash
          }
          output {
            address
            amount {
              unit
              quantity
            }
            dataHash
            plutusData
            scriptRef
            scriptHash
          }
        }
        initialTerms {
          user
          backend
          platform {
            allowedVkhs
            requiredVkhsCount
          }
          platformFundsAddr {
            platformFundsAddr {
              ScriptCredential {
                hash
              }
              stakeCredential
            }
          }
          rewardAssetName {
            name
            policyid
          }
          timeAccuracy
          period
          periodicalAmount
          cashOutCooldown
          terminationCooldown
          personalInfo {
            nickname
            fullname
            profila
            email
            phone
            city
            mailing_address
            age
            gender
            languages
          }
          categories
          commissionRate
          purpose
        }
        initialAgreedPeriodsCount
        policyid
      }
      unSignedTx
    }
  }
`;

const MUTATION_TWO = gql`
  mutation acceptSubscriptionOffer($input: AcceptSubscriptionOfferInput!) {
    acceptSubscriptionOffer(input: $input) {
    id
    offer {
      id
      name
    }
    isRejected
    isCancelled
    isCancelledByUser
    inReview
    transactionHash
    subscriptionStartedAt
    subscriptionEndsAt
    createdAt
    updatedAt
  }
  }
`;

const LucidProvider = ({ children }) => {
  const lucidState = useLucid();
  
  useEffect(() => {
    // Auto-connect on component mount
    lucidState.initializeLucid().catch(err => {
      console.error('Failed to auto-connect wallet:', err);
    });
  }, []);

  return (
    <LucidContext.Provider value={lucidState}>
      {children}
    </LucidContext.Provider>
  );
};

function App() {
  const { lucid, walletAddress, isConnected, error, initializeLucid } = useContext(LucidContext);
  const [savedData, setSavedData] = useState(null);
  const [subscription, setSubscription] = useState(null);
  const [halfsignedTx, setHalfSignedTx] = useState('');

  // GraphQL mutation hooks
  const [initSubscriptionNFTCreate] = useMutation(MUTATION_ONE, { client });
  const [acceptSubscriptionOffer] = useMutation(MUTATION_TWO, { client });

  useEffect(() => {
    // Test the Apollo Client connection
    client.query({
      query: gql`
        query TestQuery {
          __typename
        }
      `
    }).then(() => {
      console.log('Apollo Client successfully connected to endpoint');
    }).catch(error => {
      console.error('Apollo Client connection error:', error);
    });
  }, []);

  // Connect Cardano wallet using Lucid
  const connectWallet = async () => {
    try {
      //const lucid = await Lucid.new();
      await initializeLucid()
      const address = await lucid.wallet.address();
      alert(`Connected wallet: ${address}`);
    } catch (error) {
      console.error('Wallet connection failed:', error);
    }
  };

  // Trigger the first GraphQL mutation
  const handleFirstMutation = async () => {
    console.log(walletAddress)
    try {
      const response = await initSubscriptionNFTCreate({
        variables: {
          input: {userVkh: walletAddress,
            subscriptionId: "1" } // Replace with appropriate input
        },
      });
      console.log('after mutation: ', response)
      const result = response.data.initSubscriptionNFTCreate.subscription;
      setSavedData(result);
      setSubscription(result);

      const halfsignedTx = response.data.initSubscriptionNFTCreate.unSignedTx;
      setHalfSignedTx(halfsignedTx);
      alert(`First mutation success: ${result}`);
    } catch (error) {
      console.error('Error in first mutation:', error);
    }
  };

  // Trigger the second GraphQL mutation
  const handleSecondMutation = async () => {
    //const lucid = await Lucid.new();
    if (!savedData) {
      alert('No data from the first mutation. Run it first!');
      return;
    }



    console.log('address: ', await lucid.wallet.address())

    const tx = lucid.fromTx(halfsignedTx);

    const signedTx = await tx.sign().complete()

    try {
      const response = await acceptSubscriptionOffer({
        variables: {
          input: {
            subscriptionOfferId: '1',
            halfSignedTransaction: signedTx.toString(),
            userVkh: walletAddress,
            newSubscription: subscription, // Replace with other required data
          },
        },
      });
      const result = response.data.acceptSubscriptionOffer.result;
      console.log('acept results: ', result)
      alert(`Second mutation success: ${result}`);
    } catch (error) {
      console.error('Error in second mutation:', error);
    }
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial' }}>
      <h1>Cardano Wallet & GraphQL</h1>
      <button onClick={connectWallet} style={{ margin: '10px', padding: '10px' }}>
        Connect Wallet
      </button>
      <button onClick={handleFirstMutation} style={{ margin: '10px', padding: '10px' }}>
        Run First Mutation
      </button>
      <button onClick={handleSecondMutation} style={{ margin: '10px', padding: '10px' }}>
        Run Second Mutation
      </button>
      <p>Connected Wallet Address: {walletAddress || 'Not connected'}</p>
    </div>
  );
}

// Wrap the App with LucidProvider
const AppWrapper = () => (
  <LucidProvider>
    <App />
  </LucidProvider>
);


export default AppWrapper;