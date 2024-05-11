// BuyThoseTickets.js

const { ethers } = require("hardhat");
const { expect } = require("chai");
const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

const eventDate = Math.floor(Date.now() / 1000);
const ticketPrice = ethers.parseEther("0.02");

describe("BuyThoseTickets contract", function () {
    async function deployContract() {
        const [owner, addr1, addr2] = await ethers.getSigners();
        const contract = await ethers.deployContract("BuyThoseTickets");
        await contract.waitForDeployment();
        return { contract, owner, addr1, addr2 };
    }

    describe("Deployment", function () {
        it("Sets deployer as contract owner", async function () {
            const { contract, owner } = await loadFixture(deployContract);

            // Verify deployer is the contract owner
            expect(await contract.owner()).to.equal(owner.address);
        });
    });

    describe("Add Event", function () {
        it("Adds a new event to the list", async function () {
            const { contract } = await loadFixture(deployContract);
            const eventName = "Megadeth/Movistar Arena";

            // Ensure the list is empty
            expect(await contract.getAllEvents()).to.be.empty;

            // Add event
            await contract.addEvent(eventName, eventDate, ticketPrice, 1500);

            // Verify event is added
            expect(await contract.getAllEvents()).to.deep.equal([eventName]);
        });

        it("Assigns a maximum number of tickets to be sold along with the price of each ticket in Ether", async function () {
            const { contract } = await loadFixture(deployContract);
            const eventName = "Anthrax/Teatro Flores";

            // Add event
            await contract.addEvent(eventName, eventDate, ticketPrice, 1500);

            // Verify assignments
            const event = await contract.getEventInformation("Anthrax/Teatro Flores");
            expect(event).to.deep.equal([eventName, eventDate, ticketPrice, 1500, 1500]);
        });

        it("Returns a success code", async function () {
            const { contract } = await loadFixture(deployContract);

            // Add event
            const result = await contract.addEvent("Biohazard/Vorterix", eventDate, ticketPrice, 1500);

            // TODO: Verify success code in result
        });

        it("Can only be called by the owner of the contract", async function () {
            const { contract, owner, addr1 } = await loadFixture(deployContract);

            // Attempt to add event with addr1 and verify tx is reverted
            await expect(contract.connect(addr1).addEvent("Carcass/Teatro Flores", eventDate, ticketPrice, 1500))
                .to.be.revertedWithCustomError(contract, "OwnableUnauthorizedAccount")
                .withArgs(addr1);
        });

        it("Can not add an event that already exists", async function () {
            const { contract } = await loadFixture(deployContract);
            const eventName = "Clutch/Uniclub";

            // Add event
            await contract.addEvent(eventName, eventDate, ticketPrice, 1500);

            // Attempt to add event with the same name and verify tx is reverted
            await expect(contract.addEvent(eventName, eventDate, ticketPrice, 1500))
                .to.be.revertedWithCustomError(contract, "ExistingEvent")
                .withArgs(eventName);
        });
    });

    describe("Get Event Information", function () {
        it("Returns the information of a given event", async function () {
            const { contract } = await loadFixture(deployContract);
            const eventName = "Fear Factory/Vorterix";
            const maxTickets = 1500;
            const ticketsLeft = maxTickets;

            // Add event
            await contract.addEvent("Fear Factory/Vorterix", eventDate, ticketPrice, maxTickets);

            // Verify event information
            const event = await contract.getEventInformation(eventName);
            expect(event).to.deep.equal([eventName, eventDate, ticketPrice, maxTickets, ticketsLeft]);
        });

        it("Returns how many tickets are left", async function () {
            const { contract, owner, addr1, addr2 } = await loadFixture(deployContract);
            const eventName = "Helmet/Uniclub";
            const maxTickets = 3;
            let ticketsLeft = maxTickets;

            // Add event
            await contract.addEvent(eventName, ticketPrice, 1, maxTickets);

            // Buy 1 ticket
            await contract.buyTicket(eventName, { value: ticketPrice });

            // Verify tickets left
            ticketsLeft = ticketsLeft - 1;
            let event = await contract.getEventInformation(eventName);
            expect(event).to.deep.equal([eventName, ticketPrice, 1, maxTickets, ticketsLeft]);

            // Buy all tickets
            await contract.connect(addr1).buyTicket(eventName, { value: ticketPrice });
            await contract.connect(addr2).buyTicket(eventName, { value: ticketPrice });

            // Verify no more tickets are available
            ticketsLeft = 0;
            event = await contract.getEventInformation(eventName);
            expect(event).to.deep.equal([eventName, ticketPrice, 1, maxTickets, ticketsLeft]);
        });
    });

    describe("Buy ticket", function () {
        it("Can be called by any address by adding the price of the entrance to the transaction", async function () {
            const { contract, owner, addr1, addr2 } = await loadFixture(deployContract);
            const eventName = "Prong/Uniclub";

            // Add event
            await contract.addEvent(eventName, eventDate, ticketPrice, 1500);

            // Buy tickets with different addresses
            await contract.buyTicket(eventName, { value: ticketPrice });
            await contract.connect(addr1).buyTicket(eventName, { value: ticketPrice });

            // Attempt to buy ticket with less ether than ticket price and verify tx is reverted
            await expect(contract.connect(addr2).buyTicket(eventName, { value: ticketPrice - 1n }))
                .to.be.revertedWithCustomError(contract, "TicketPriceNotCovered")
                .withArgs(ticketPrice);
        });

        it("Registers the address as the owner of a ticket of a given event", async function () {
            const { contract, owner, addr1 } = await loadFixture(deployContract);
            const eventName = "SoulFly/Teatro Colegiales";

            // Add event
            await contract.addEvent(eventName, eventDate, ticketPrice, 1500);

            // Buy ticket with addr1
            await contract.connect(addr1).buyTicket(eventName, { value: ticketPrice });

            // Verify addr1 is registered as ticket owner
            expect(await contract.connect(addr1).ticketOwned(eventName)).to.be.true;

            // Verify another address is not regsitered
            expect(await contract.connect(owner).ticketOwned(eventName)).to.be.false;
        });

        it("An address can only own a single ticket from each event", async function () {
            const { contract, owner } = await loadFixture(deployContract);
            const eventName = "Pantera/Obras Sanitarias";

            // Add event and buy ticket
            await contract.addEvent(eventName, eventDate, ticketPrice, 1500);
            await contract.buyTicket(eventName, { value: ticketPrice });

            // Attempt to buy 1 more ticket and verify tx is reverted
            await expect(contract.buyTicket(eventName, { value: ticketPrice }))
                .to.be.revertedWithCustomError(contract, "AlreadyOwner")
                .withArgs(owner);
        });

        it("Tickets can only be purchased if they are available", async function () {
            const { contract, owner, addr1, addr2 } = await loadFixture(deployContract);
            const eventName = "Pantera/Ferro";
            const maxTickets = 2;

            // Add event
            await contract.addEvent(eventName, eventDate, ticketPrice, maxTickets);

            // Buy all tickets
            await contract.connect(addr1).buyTicket(eventName, { value: ticketPrice });
            await contract.connect(addr2).buyTicket(eventName, { value: ticketPrice });

            // Attempt to buy 1 more ticket and verify tx is reverted
            await expect(contract.connect(owner).buyTicket(eventName, { value: ticketPrice }))
                .to.be.revertedWithCustomError(contract, "AllTicketsSold")
                .withArgs(maxTickets);
        });

        it("Returns a success code", async function () {
            const { contract } = await loadFixture(deployContract);
            const eventName = "Pantera/Parque Sarmiento";

            // Add event
            await contract.addEvent(eventName, eventDate, ticketPrice, 1500);

            // Buy ticket
            const result = await contract.buyTicket(eventName, { value: ticketPrice });

            // TODO: Verify success code in result
        });
    });

    describe("Tickets Owned", function () {
        it("Checks all events that the sender address has ownership of a ticket", async function () {
            const { contract, owner, addr1 } = await loadFixture(deployContract);
            const eventNames = [
                "Limp Bizkit/Obras Sanitarias",
                "Limp Bizkit/Luna Park",
                "Limp Bizkit/Movistar Arena"
            ];

            // Add events
            await contract.addEvent(eventNames[0], eventDate, ticketPrice, 1500);
            await contract.addEvent(eventNames[1], eventDate, ticketPrice, 1500);
            await contract.addEvent(eventNames[2], eventDate, ticketPrice, 1500);

            // Buy tickets
            await contract.buyTicket(eventNames[0], { value: ticketPrice });
            await contract.buyTicket(eventNames[1], { value: ticketPrice });
            await contract.buyTicket(eventNames[2], { value: ticketPrice });

            // Verify owner of all events
            expect(await contract.ticketsOwned()).to.deep.equal(eventNames);

            // Verify not owner of any event
            expect(await contract.connect(addr1).ticketsOwned()).to.be.empty;
        });
    });

    describe("Resell Ticket", function () {
        it("Changes the ownership of a ticket from the owner to another address", async function () {
            const { contract, owner, addr1, addr2 } = await loadFixture(deployContract);
            const eventName = "Machine Head/Teatro Flores";

            // Add event and buy ticket with addr1
            await contract.addEvent(eventName, eventDate, ticketPrice, 1500);
            await contract.connect(addr1).buyTicket(eventName, { value: ticketPrice });

            // Ensure addr1 is owner and addr2 is not
            expect(await contract.connect(addr1).ticketOwned(eventName)).to.be.true;
            expect(await contract.connect(addr2).ticketOwned(eventName)).to.be.false;

            // Transfer ownership
            await contract.connect(addr1).resellTicket(eventName, addr2);

            // Verify addr1 is not owner and addr2 is owner
            expect(await contract.connect(addr1).ticketOwned(eventName)).to.be.false;
            expect(await contract.connect(addr2).ticketOwned(eventName)).to.be.true;
        });

        it("Can only be called by the address that owns the ticket of an event", async function () {
            const { contract, owner, addr1, addr2 } = await loadFixture(deployContract);
            const eventName = "Suicidal Tendencies/Teatro Flores";

            // Add event and buy ticket with addr1
            await contract.addEvent(eventName, eventDate, ticketPrice, 1500);
            await contract.connect(addr1).buyTicket(eventName, { value: ticketPrice });

            // Attempt to transfer ownership from addr2 to addr1 and verify tx is reverted
            await expect(contract.connect(addr2).resellTicket(eventName, addr1))
                .to.be.revertedWithCustomError(contract, "NotOwner")
                .withArgs(addr2);
        });

        it("does not transfer ownership if the receiver already owns a ticket of the event", async function () {
            const { contract, owner, addr1, addr2 } = await loadFixture(deployContract);
            const eventName = "Suicidal Tendencies/Teatro Flores";

            // Add event and buy tickets with addr1 and addr2
            await contract.addEvent(eventName, eventDate, ticketPrice, 1500);
            await contract.connect(addr1).buyTicket(eventName, { value: ticketPrice });
            await contract.connect(addr2).buyTicket(eventName, { value: ticketPrice });

            // Attempt to transfer ownership from addr1 to addr2 and verify tx is reverted
            await expect(contract.connect(addr1).resellTicket(eventName, addr2))
                .to.be.revertedWithCustomError(contract, "AlreadyOwner")
                .withArgs(addr2);
        });
    });
});
