pragma solidity ^0.8.24;

import { FHE, euint32, externalEuint32 } from "@fhevm/solidity/lib/FHE.sol";
import { ZamaEthereumConfig } from "@fhevm/solidity/config/ZamaConfig.sol";

contract NoiseMapAdapter is ZamaEthereumConfig {
    
    struct NoiseReading {
        string deviceId;               
        euint32 encryptedDecibels;     
        uint256 timestamp;             
        uint256 locationHash;          
        address submitter;             
        uint32 decryptedDecibels;      
        bool isVerified;               
    }
    
    mapping(string => NoiseReading) public noiseReadings;
    string[] public deviceIds;
    
    event NoiseReadingSubmitted(string indexed deviceId, address indexed submitter);
    event DecryptionVerified(string indexed deviceId, uint32 decryptedDecibels);
    
    constructor() ZamaEthereumConfig() {
    }
    
    function submitNoiseReading(
        string calldata deviceId,
        externalEuint32 encryptedDecibels,
        bytes calldata inputProof,
        uint256 locationHash
    ) external {
        require(bytes(noiseReadings[deviceId].deviceId).length == 0, "Device already registered");
        
        require(FHE.isInitialized(FHE.fromExternal(encryptedDecibels, inputProof)), "Invalid encrypted input");
        
        noiseReadings[deviceId] = NoiseReading({
            deviceId: deviceId,
            encryptedDecibels: FHE.fromExternal(encryptedDecibels, inputProof),
            timestamp: block.timestamp,
            locationHash: locationHash,
            submitter: msg.sender,
            decryptedDecibels: 0,
            isVerified: false
        });
        
        FHE.allowThis(noiseReadings[deviceId].encryptedDecibels);
        FHE.makePubliclyDecryptable(noiseReadings[deviceId].encryptedDecibels);
        
        deviceIds.push(deviceId);
        
        emit NoiseReadingSubmitted(deviceId, msg.sender);
    }
    
    function verifyDecryption(
        string calldata deviceId, 
        bytes memory abiEncodedClearValue,
        bytes memory decryptionProof
    ) external {
        require(bytes(noiseReadings[deviceId].deviceId).length > 0, "Device not registered");
        require(!noiseReadings[deviceId].isVerified, "Data already verified");
        
        bytes32[] memory cts = new bytes32[](1);
        cts[0] = FHE.toBytes32(noiseReadings[deviceId].encryptedDecibels);
        
        FHE.checkSignatures(cts, abiEncodedClearValue, decryptionProof);
        
        uint32 decodedValue = abi.decode(abiEncodedClearValue, (uint32));
        
        noiseReadings[deviceId].decryptedDecibels = decodedValue;
        noiseReadings[deviceId].isVerified = true;
        
        emit DecryptionVerified(deviceId, decodedValue);
    }
    
    function getEncryptedDecibels(string calldata deviceId) external view returns (euint32) {
        require(bytes(noiseReadings[deviceId].deviceId).length > 0, "Device not registered");
        return noiseReadings[deviceId].encryptedDecibels;
    }
    
    function getNoiseReading(string calldata deviceId) external view returns (
        uint256 timestamp,
        uint256 locationHash,
        address submitter,
        bool isVerified,
        uint32 decryptedDecibels
    ) {
        require(bytes(noiseReadings[deviceId].deviceId).length > 0, "Device not registered");
        NoiseReading storage reading = noiseReadings[deviceId];
        
        return (
            reading.timestamp,
            reading.locationHash,
            reading.submitter,
            reading.isVerified,
            reading.decryptedDecibels
        );
    }
    
    function getAllDeviceIds() external view returns (string[] memory) {
        return deviceIds;
    }
    
    function isAvailable() public pure returns (bool) {
        return true;
    }
}


