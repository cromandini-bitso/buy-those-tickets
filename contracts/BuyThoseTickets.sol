// SPDX-License-Identifier: MIT

pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

contract BuyThoseTickets is Ownable {
    using EnumerableSet for EnumerableSet.AddressSet;
    using EnumerableSet for EnumerableSet.Bytes32Set;

    struct EventData {
        string name;
        uint date;
        uint ticketPrice;
        uint maxTickets;
        EnumerableSet.AddressSet owners;
    }

    struct EventInfo {
        string name;
        uint date;
        uint ticketPrice;
        uint maxTickets;
        uint ticketsLeft;
    }

    error ExistingEvent(string name);
    error EventNotFound(string name);
    error AlreadyOwner(address owner);
    error AllTicketsSold(uint maxTickets);
    error TicketPriceNotCovered(uint ticketPrice);
    error NotOwner(address sender);

    mapping(bytes32 => EventData) private events;
    EnumerableSet.Bytes32Set private eventIds;

    constructor() Ownable(msg.sender) {}

    function addEvent(
        string memory _name,
        uint _date,
        uint _ticketPrice,
        uint _maxTickets
    ) external onlyOwner returns (uint) {
        bytes32 eventId = getEventId(_name);
        if (eventIds.contains(eventId)) {
            revert ExistingEvent(_name);
        }
        eventIds.add(eventId);
        events[eventId].name = _name;
        events[eventId].date = _date;
        events[eventId].ticketPrice = _ticketPrice;
        events[eventId].maxTickets = _maxTickets;
        return 1;
    }

    function getAllEvents() external view returns (string[] memory) {
        string[] memory result = new string[](eventIds.length());
        for (uint i = 0; i < eventIds.length(); i++) {
            result[i] = events[eventIds.at(i)].name;
        }
        return result;
    }

    function getEventInformation(
        string memory _name
    ) external view eventFound(_name) returns (EventInfo memory) {
        EventData storage eventData = events[getEventId(_name)];
        return
            EventInfo(
                eventData.name,
                eventData.date,
                eventData.ticketPrice,
                eventData.maxTickets,
                eventData.maxTickets - eventData.owners.length()
            );
    }

    function buyTicket(
        string memory _eventName
    ) external payable eventFound(_eventName) returns (uint) {
        EventData storage eventData = events[getEventId(_eventName)];
        if (eventData.owners.contains(msg.sender)) {
            revert AlreadyOwner(msg.sender);
        }
        if (eventData.owners.length() == eventData.maxTickets) {
            revert AllTicketsSold(eventData.maxTickets);
        }
        if (msg.value < eventData.ticketPrice) {
            revert TicketPriceNotCovered(eventData.ticketPrice);
        }
        eventData.owners.add(msg.sender);
        return 1;
    }

    function ticketOwned(
        string memory _eventName
    ) external view eventFound(_eventName) returns (bool) {
        EventData storage eventData = events[getEventId(_eventName)];
        return eventData.owners.contains(msg.sender);
    }

    function ticketsOwned() external view returns (string[] memory) {
        uint count = 0;
        for (uint i = 0; i < eventIds.length(); i++) {
            bytes32 eventId = eventIds.at(i);
            EventData storage eventData = events[eventId];
            if (eventData.owners.contains(msg.sender)) {
                count++;
            }
        }
        string[] memory eventNames = new string[](count);
        uint cursor = 0;
        for (uint i = 0; i < eventIds.length(); i++) {
            bytes32 eventId = eventIds.at(i);
            EventData storage eventData = events[eventId];
            if (eventData.owners.contains(msg.sender)) {
                eventNames[cursor] = eventData.name;
                cursor++;
            }
        }
        return eventNames;
    }

    function resellTicket(
        string memory _eventName,
        address receiver
    ) external eventFound(_eventName) returns (uint) {
        EventData storage eventData = events[getEventId(_eventName)];
        if (!eventData.owners.contains(msg.sender)) {
            revert NotOwner(msg.sender);
        }
        if (eventData.owners.contains(receiver)) {
            revert AlreadyOwner(receiver);
        }
        eventData.owners.remove(msg.sender);
        eventData.owners.add(receiver);
        return 1;
    }

    function withdrawFunds() external onlyOwner {
        uint balance = address(this).balance;
        address payable owner = payable(msg.sender);
        owner.transfer(balance);
    }

    modifier eventFound(string memory _name) {
        bytes32 eventId = getEventId(_name);
        if (!eventIds.contains(eventId)) {
            revert EventNotFound(_name);
        }
        _;
    }

    function getEventId(string memory _name) private pure returns (bytes32) {
        return keccak256(abi.encodePacked(_name));
    }
}
