pragma solidity ^0.8.7;

import "hardhat/console.sol";

contract Contract {
  // address owner;

  struct manufactureObj {
    uint prod_id;
    string prod_name;
    uint quantity;
  }

  struct transportObj {
    uint transport_id;
    string name;
    bool verify;
  }
    
  struct retailerObj {
    uint retail_id;
    string name;
    bool verify;
  }


  mapping (string => manufactureObj) manufactureArr; 
  mapping (string => transportObj) customerArr;
  mapping (string => retailerObj) retailerArr;

    
function createProd(uint _prod_id, string memory _prod_name, uint _quantity) public payable returns (uint) {
        manufactureObj memory newProd;
        newProd.prod_id = _prod_id;
        newProd.prod_name = _prod_name;
        newProd.quantity = _quantity;
        return 1;
    }


function verifyRetail(bool _verify) public pure returns (bool) {
  if(_verify = true) {
    return true;
  } else {
    return false;
  }
}

function verifyTransport(bool _verify) public pure returns (bool) {
  if(_verify = true) {
    return true;
  } else {
    return false;
  }
}

function stringToBytes32(string memory source) internal pure returns (bytes32 result) {
        bytes memory tempEmptyStringTest = bytes(source);
        if (tempEmptyStringTest.length == 0) {
            return 0x0;
        }
        assembly {
            result := mload(add(source, 32))
        }
    }

}