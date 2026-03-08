"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    const heads = await queryInterface.sequelize.query(
      `SELECT id, category_head_name FROM ItemCategoryHeads`,
      { type: Sequelize.QueryTypes.SELECT }
    );

    const headMap = {};
    heads.forEach(h => {
      headMap[h.category_head_name] = h.id;
    });

    const now = new Date();

    await queryInterface.bulkInsert("ItemCategoryGroups", [

      // Stationery
      { category_group_name: "Paper", head_id: headMap["Stationery"], createdAt: now, updatedAt: now },
      { category_group_name: "Writing Items", head_id: headMap["Stationery"], createdAt: now, updatedAt: now },
      { category_group_name: "Files & Folders", head_id: headMap["Stationery"], createdAt: now, updatedAt: now },
      { category_group_name: "Registers & Notebooks", head_id: headMap["Stationery"], createdAt: now, updatedAt: now },
      { category_group_name: "Printing Consumables", head_id: headMap["Stationery"], createdAt: now, updatedAt: now },
      { category_group_name: "Office Accessories", head_id: headMap["Stationery"], createdAt: now, updatedAt: now },
      { category_group_name: "Stamps & Pads", head_id: headMap["Stationery"], createdAt: now, updatedAt: now },
      { category_group_name: "Envelopes & Covers", head_id: headMap["Stationery"], createdAt: now, updatedAt: now },

      // IT Equipment
      { category_group_name: "Desktop Computers", head_id: headMap["IT Equipment"], createdAt: now, updatedAt: now },
      { category_group_name: "Laptops", head_id: headMap["IT Equipment"], createdAt: now, updatedAt: now },
      { category_group_name: "Servers", head_id: headMap["IT Equipment"], createdAt: now, updatedAt: now },
      { category_group_name: "Networking Devices", head_id: headMap["IT Equipment"], createdAt: now, updatedAt: now },
      { category_group_name: "Storage Devices", head_id: headMap["IT Equipment"], createdAt: now, updatedAt: now },
      { category_group_name: "Input Devices", head_id: headMap["IT Equipment"], createdAt: now, updatedAt: now },
      { category_group_name: "Output Devices", head_id: headMap["IT Equipment"], createdAt: now, updatedAt: now },
      { category_group_name: "IT Accessories", head_id: headMap["IT Equipment"], createdAt: now, updatedAt: now },

      // Electronics
      { category_group_name: "Printers", head_id: headMap["Electronics"], createdAt: now, updatedAt: now },
      { category_group_name: "Scanners", head_id: headMap["Electronics"], createdAt: now, updatedAt: now },
      { category_group_name: "Photocopiers", head_id: headMap["Electronics"], createdAt: now, updatedAt: now },
      { category_group_name: "CCTV Equipment", head_id: headMap["Electronics"], createdAt: now, updatedAt: now },
      { category_group_name: "Biometric Devices", head_id: headMap["Electronics"], createdAt: now, updatedAt: now },
      { category_group_name: "Attendance Systems", head_id: headMap["Electronics"], createdAt: now, updatedAt: now },
      { category_group_name: "Display Devices", head_id: headMap["Electronics"], createdAt: now, updatedAt: now },
      { category_group_name: "Audio Video Equipment", head_id: headMap["Electronics"], createdAt: now, updatedAt: now },

      // Electricals
      { category_group_name: "Lighting Fixtures", head_id: headMap["Electricals"], createdAt: now, updatedAt: now },
      { category_group_name: "Fans & Ventilation", head_id: headMap["Electricals"], createdAt: now, updatedAt: now },
      { category_group_name: "Switches & Sockets", head_id: headMap["Electricals"], createdAt: now, updatedAt: now },
      { category_group_name: "Cables & Wiring", head_id: headMap["Electricals"], createdAt: now, updatedAt: now },
      { category_group_name: "Electrical Accessories", head_id: headMap["Electricals"], createdAt: now, updatedAt: now },
      { category_group_name: "Electrical Appliances", head_id: headMap["Electricals"], createdAt: now, updatedAt: now },

      // Furniture
      { category_group_name: "Office Furniture", head_id: headMap["Furniture"], createdAt: now, updatedAt: now },
      { category_group_name: "Storage Furniture", head_id: headMap["Furniture"], createdAt: now, updatedAt: now },
      { category_group_name: "Seating Furniture", head_id: headMap["Furniture"], createdAt: now, updatedAt: now },
      { category_group_name: "Workstations", head_id: headMap["Furniture"], createdAt: now, updatedAt: now },
      { category_group_name: "Conference Furniture", head_id: headMap["Furniture"], createdAt: now, updatedAt: now },

      // Vehicles
      { category_group_name: "Cars", head_id: headMap["Vehicles"], createdAt: now, updatedAt: now },
      { category_group_name: "Two Wheelers", head_id: headMap["Vehicles"], createdAt: now, updatedAt: now },
      { category_group_name: "Buses", head_id: headMap["Vehicles"], createdAt: now, updatedAt: now },
      { category_group_name: "Vehicle Accessories", head_id: headMap["Vehicles"], createdAt: now, updatedAt: now },
      { category_group_name: "Tyres & Tubes", head_id: headMap["Vehicles"], createdAt: now, updatedAt: now },
      { category_group_name: "Vehicle Batteries", head_id: headMap["Vehicles"], createdAt: now, updatedAt: now },

      // Machinery
      { category_group_name: "Office Machines", head_id: headMap["Machinery"], createdAt: now, updatedAt: now },
      { category_group_name: "Industrial Machines", head_id: headMap["Machinery"], createdAt: now, updatedAt: now },
      { category_group_name: "Workshop Machines", head_id: headMap["Machinery"], createdAt: now, updatedAt: now },
      { category_group_name: "Printing Machines", head_id: headMap["Machinery"], createdAt: now, updatedAt: now },
      { category_group_name: "Heavy Equipment", head_id: headMap["Machinery"], createdAt: now, updatedAt: now },

      // Tools & Hardware
      { category_group_name: "Hand Tools", head_id: headMap["Tools & Hardware"], createdAt: now, updatedAt: now },
      { category_group_name: "Power Tools", head_id: headMap["Tools & Hardware"], createdAt: now, updatedAt: now },
      { category_group_name: "Fasteners", head_id: headMap["Tools & Hardware"], createdAt: now, updatedAt: now },
      { category_group_name: "Fittings", head_id: headMap["Tools & Hardware"], createdAt: now, updatedAt: now },
      { category_group_name: "Safety Tools", head_id: headMap["Tools & Hardware"], createdAt: now, updatedAt: now },

      // Power & Backup
      { category_group_name: "Generators", head_id: headMap["Power & Backup"], createdAt: now, updatedAt: now },
      { category_group_name: "UPS Systems", head_id: headMap["Power & Backup"], createdAt: now, updatedAt: now },
      { category_group_name: "Inverters", head_id: headMap["Power & Backup"], createdAt: now, updatedAt: now },
      { category_group_name: "Batteries", head_id: headMap["Power & Backup"], createdAt: now, updatedAt: now },
      { category_group_name: "Solar Equipment", head_id: headMap["Power & Backup"], createdAt: now, updatedAt: now },

      // Security Systems
      { category_group_name: "CCTV Cameras", head_id: headMap["Security Systems"], createdAt: now, updatedAt: now },
      { category_group_name: "Access Control", head_id: headMap["Security Systems"], createdAt: now, updatedAt: now },
      { category_group_name: "Fire Safety Equipment", head_id: headMap["Security Systems"], createdAt: now, updatedAt: now },
      { category_group_name: "Alarm Systems", head_id: headMap["Security Systems"], createdAt: now, updatedAt: now },
      { category_group_name: "Surveillance Accessories", head_id: headMap["Security Systems"], createdAt: now, updatedAt: now },

      // Housekeeping
      { category_group_name: "Cleaning Materials", head_id: headMap["Housekeeping"], createdAt: now, updatedAt: now },
      { category_group_name: "Cleaning Tools", head_id: headMap["Housekeeping"], createdAt: now, updatedAt: now },
      { category_group_name: "Sanitation Supplies", head_id: headMap["Housekeeping"], createdAt: now, updatedAt: now },
      { category_group_name: "Waste Management", head_id: headMap["Housekeeping"], createdAt: now, updatedAt: now },

      // Gardening
      { category_group_name: "Plants", head_id: headMap["Gardening"], createdAt: now, updatedAt: now },
      { category_group_name: "Pots & Planters", head_id: headMap["Gardening"], createdAt: now, updatedAt: now },
      { category_group_name: "Gardening Tools", head_id: headMap["Gardening"], createdAt: now, updatedAt: now },
      { category_group_name: "Fertilizers", head_id: headMap["Gardening"], createdAt: now, updatedAt: now },
      { category_group_name: "Irrigation Accessories", head_id: headMap["Gardening"], createdAt: now, updatedAt: now },

      // Spares
      { category_group_name: "Electrical Spares", head_id: headMap["Spares"], createdAt: now, updatedAt: now },
      { category_group_name: "Mechanical Spares", head_id: headMap["Spares"], createdAt: now, updatedAt: now },
      { category_group_name: "Electronic Spares", head_id: headMap["Spares"], createdAt: now, updatedAt: now },
      { category_group_name: "IT Spares", head_id: headMap["Spares"], createdAt: now, updatedAt: now },
      { category_group_name: "Vehicle Spares", head_id: headMap["Spares"], createdAt: now, updatedAt: now },

      // Laboratory Equipment
      { category_group_name: "Measuring Instruments", head_id: headMap["Laboratory Equipment"], createdAt: now, updatedAt: now },
      { category_group_name: "Testing Equipment", head_id: headMap["Laboratory Equipment"], createdAt: now, updatedAt: now },
      { category_group_name: "Lab Furniture", head_id: headMap["Laboratory Equipment"], createdAt: now, updatedAt: now },
      { category_group_name: "Lab Consumables", head_id: headMap["Laboratory Equipment"], createdAt: now, updatedAt: now },

      // Medical Equipment
      { category_group_name: "Diagnostic Equipment", head_id: headMap["Medical Equipment"], createdAt: now, updatedAt: now },
      { category_group_name: "First Aid Equipment", head_id: headMap["Medical Equipment"], createdAt: now, updatedAt: now },
      { category_group_name: "Medical Devices", head_id: headMap["Medical Equipment"], createdAt: now, updatedAt: now },
      { category_group_name: "Medical Consumables", head_id: headMap["Medical Equipment"], createdAt: now, updatedAt: now },

      // Miscellaneous
      { category_group_name: "Miscellaneous Items", head_id: headMap["Miscellaneous"], createdAt: now, updatedAt: now },
      { category_group_name: "Emergency Purchases", head_id: headMap["Miscellaneous"], createdAt: now, updatedAt: now },
      { category_group_name: "Unclassified Items", head_id: headMap["Miscellaneous"], createdAt: now, updatedAt: now },

    ], {});
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete("ItemCategoryGroups", null, {});
  },
};
