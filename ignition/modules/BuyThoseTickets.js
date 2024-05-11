const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

const BuyThoseTicketsModule = buildModule("BuyThoseTicketsModule", (m) => {
    const buyThoseTickets = m.contract("BuyThoseTickets");

    return { buyThoseTickets };
});

module.exports = BuyThoseTicketsModule;
