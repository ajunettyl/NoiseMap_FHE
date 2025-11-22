# NoiseMap_FHE: A Privacy-Preserving Noise Monitoring Application

NoiseMap_FHE is an innovative solution for monitoring urban noise levels while ensuring user privacy. Powered by Zama's Fully Homomorphic Encryption (FHE) technology, this application enables users to collect and submit noise level data without compromising their location or identity. By producing a comprehensive city noise map without exposing sensitive information, NoiseMap_FHE represents a significant advancement in environmental monitoring and community engagement.

## The Problem

In urban environments, noise pollution has become a pressing issue affecting health, well-being, and overall quality of life. Traditional noise monitoring approaches often require collecting data in cleartext, which poses substantial privacy risks. Personal location information can be misused or exploited, leading to potential safety concerns for users. Moreover, aggregated data without adequate privacy measures could discourage participation from individuals who are worried about their data being linked back to them.

## The Zama FHE Solution

Fully Homomorphic Encryption (FHE) offers a robust solution to these challenges by allowing computations to be performed on encrypted data. This means that we can analyze noise levels and generate heat maps without ever accessing the underlying private information. Using Zama's frameworks, such as fhevm, we securely process encrypted inputs from users' mobile devices. The result is a noise map that empowers communities to assess noise pollution without sacrificing individual privacy.

## Key Features

- 🔒 **Privacy Protection**: Users can contribute noise data securely without revealing their location.
- 🗺️ **Noise Heat Maps**: Visual representation of noise pollution across urban areas, helping communities identify problematic zones.
- 🌱 **Environmental Awareness**: Facilitate discussions and actions around noise pollution and its impact on community health.
- 📱 **Mobile Integration**: Easy-to-use mobile application for real-time noise level submission.
- 🤝 **Community Collaboration**: Encourage citizen involvement in environmental monitoring and urban planning. 

## Technical Architecture & Stack

NoiseMap_FHE employs a well-defined tech stack centered on Zama's powerful privacy tools. Here’s a rundown of the components:

- **Core Privacy Engine**: Zama's technologies (fhevm, Concrete ML)
- **Frontend**: Mobile application (React Native)
- **Backend**: Node.js with Express.js
- **Database**: Encrypted storage using FHE techniques
- **Encryption**: Fully Homomorphic Encryption for all data processing

## Smart Contract / Core Logic

Below is a simplified pseudo-code snippet that illustrates how NoiseMap_FHE utilizes Zama's libraries for processing encrypted audio features:

```solidity
pragma solidity ^0.8.0;

import "ZamaLibrary.sol";

contract NoiseMap {
    function submitNoiseData(uint64 encryptedAudio) public {
        uint64 noiseLevel = TFHE.decrypt(encryptedAudio);
        // Process the noise level data
        // Store or aggregate as needed
    }

    function generateHeatMap() public view returns (uint64[] memory) {
        // Logic to generate heat map using aggregated noise data
    }
}
```

## Directory Structure

Here is the structure of the NoiseMap_FHE project:

```
NoiseMap_FHE/
├── .sol (NoiseMap.sol)
├── mobile-app/
│   ├── src/
│   │   ├── components/
│   │   ├── screens/
│   │   └── App.js
│   └── package.json
├── backend/
│   ├── src/
│   │   ├── index.js
│   │   ├── models/
│   │   └── routes/
│   └── package.json
└── README.md
```

## Installation & Setup

To set up the NoiseMap_FHE project, follow the instructions below:

### Prerequisites

Ensure that you have the following installed:

- Node.js
- npm or pip (for Python environments)

### Installing Dependencies

1. For the backend, navigate to the `backend` directory and run:

   ```bash
   npm install
   ```

2. For the mobile application, navigate to the `mobile-app` directory and execute:

   ```bash
   npm install
   ```

3. In both directories, ensure to install the specific Zama library:

   ```bash
   npm install fhevm
   ```

## Build & Run

To build and run the application, follow these steps:

1. **Backend**: From the `backend` directory, start the server:

   ```bash
   node src/index.js
   ```

2. **Mobile Application**: From the `mobile-app` directory, run:

   ```bash
   npx react-native run-android  # for Android
   npx react-native run-ios      # for iOS
   ```

## Acknowledgements

We extend our deepest appreciation to Zama for providing the open-source FHE primitives that enable this project. Their cutting-edge technology allows us to ensure user privacy while contributing to environmental awareness and community efforts in noise pollution monitoring.


