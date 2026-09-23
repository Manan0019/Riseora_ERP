import db from "../database.js";

const CATEGORIES = [
  {
    "code": "POWDER",
    "name": "Powder",
    "inventoryRole": "RAW"
  },
  {
    "code": "CHEM",
    "name": "Chemical",
    "inventoryRole": "RAW"
  },
  {
    "code": "HYDRO",
    "name": "Hydrosol",
    "inventoryRole": "RAW"
  },
  {
    "code": "FRAG",
    "name": "Fragrance",
    "inventoryRole": "RAW"
  },
  {
    "code": "COLOR",
    "name": "Color",
    "inventoryRole": "RAW"
  },
  {
    "code": "EXTRACT",
    "name": "Liquid Extract",
    "inventoryRole": "RAW"
  },
  {
    "code": "EO",
    "name": "EO",
    "inventoryRole": "RAW"
  },
  {
    "code": "BASEOIL",
    "name": "Base Oil",
    "inventoryRole": "RAW"
  },
  {
    "code": "CLAY",
    "name": "Clay",
    "inventoryRole": "RAW"
  },
  {
    "code": "SOAPBASE",
    "name": "Soap Base",
    "inventoryRole": "RAW"
  },
  {
    "code": "PACKAGING",
    "name": "Packaging",
    "inventoryRole": "PACK"
  },
  {
    "code": "HERB",
    "name": "Herba",
    "inventoryRole": "RAW"
  },
  {
    "code": "FINISHED",
    "name": "Finished Product",
    "inventoryRole": "FG"
  }
];

const ITEMS = [
  {
    "code": "POW-001",
    "name": "white sandalwood",
    "categoryCode": "POWDER",
    "unitCode": "KG",
    "reorderLevel": 0.5,
    "trackExpiry": true
  },
  {
    "code": "POW-002",
    "name": "red sandalwood",
    "categoryCode": "POWDER",
    "unitCode": "KG",
    "reorderLevel": 0.5,
    "trackExpiry": true
  },
  {
    "code": "POW-003",
    "name": "neem",
    "categoryCode": "POWDER",
    "unitCode": "KG",
    "reorderLevel": 0.5,
    "trackExpiry": true
  },
  {
    "code": "POW-004",
    "name": "tulsi",
    "categoryCode": "POWDER",
    "unitCode": "KG",
    "reorderLevel": 0.5,
    "trackExpiry": true
  },
  {
    "code": "POW-005",
    "name": "manishtha",
    "categoryCode": "POWDER",
    "unitCode": "KG",
    "reorderLevel": 0.5,
    "trackExpiry": true
  },
  {
    "code": "POW-006",
    "name": "mulethi",
    "categoryCode": "POWDER",
    "unitCode": "KG",
    "reorderLevel": 0.5,
    "trackExpiry": true
  },
  {
    "code": "POW-007",
    "name": "hibiscus",
    "categoryCode": "POWDER",
    "unitCode": "KG",
    "reorderLevel": 0.5,
    "trackExpiry": true
  },
  {
    "code": "POW-008",
    "name": "rose",
    "categoryCode": "POWDER",
    "unitCode": "KG",
    "reorderLevel": 0.5,
    "trackExpiry": true
  },
  {
    "code": "POW-009",
    "name": "awla",
    "categoryCode": "POWDER",
    "unitCode": "KG",
    "reorderLevel": 0.5,
    "trackExpiry": true
  },
  {
    "code": "POW-010",
    "name": "lodra",
    "categoryCode": "POWDER",
    "unitCode": "KG",
    "reorderLevel": 0.5,
    "trackExpiry": true
  },
  {
    "code": "POW-011",
    "name": "vetiver",
    "categoryCode": "POWDER",
    "unitCode": "KG",
    "reorderLevel": 0.5,
    "trackExpiry": true
  },
  {
    "code": "POW-012",
    "name": "vachha",
    "categoryCode": "POWDER",
    "unitCode": "KG",
    "reorderLevel": 0.5,
    "trackExpiry": true
  },
  {
    "code": "POW-013",
    "name": "jayfal",
    "categoryCode": "POWDER",
    "unitCode": "KG",
    "reorderLevel": 0.5,
    "trackExpiry": true
  },
  {
    "code": "POW-014",
    "name": "orange peel",
    "categoryCode": "POWDER",
    "unitCode": "KG",
    "reorderLevel": 0.5,
    "trackExpiry": true
  },
  {
    "code": "POW-015",
    "name": "lemon peel",
    "categoryCode": "POWDER",
    "unitCode": "KG",
    "reorderLevel": 0.5,
    "trackExpiry": true
  },
  {
    "code": "POW-016",
    "name": "heen",
    "categoryCode": "POWDER",
    "unitCode": "KG",
    "reorderLevel": 0.5,
    "trackExpiry": true
  },
  {
    "code": "POW-017",
    "name": "indigo",
    "categoryCode": "POWDER",
    "unitCode": "KG",
    "reorderLevel": 0.5,
    "trackExpiry": true
  },
  {
    "code": "POW-018",
    "name": "trifala",
    "categoryCode": "POWDER",
    "unitCode": "KG",
    "reorderLevel": 0.5,
    "trackExpiry": true
  },
  {
    "code": "POW-019",
    "name": "himage",
    "categoryCode": "POWDER",
    "unitCode": "KG",
    "reorderLevel": 0.5,
    "trackExpiry": true
  },
  {
    "code": "POW-020",
    "name": "variyali",
    "categoryCode": "POWDER",
    "unitCode": "KG",
    "reorderLevel": 0.5,
    "trackExpiry": true
  },
  {
    "code": "POW-021",
    "name": "sunth",
    "categoryCode": "POWDER",
    "unitCode": "KG",
    "reorderLevel": 0.5,
    "trackExpiry": true
  },
  {
    "code": "POW-022",
    "name": "curry",
    "categoryCode": "POWDER",
    "unitCode": "KG",
    "reorderLevel": 0.5,
    "trackExpiry": true
  },
  {
    "code": "POW-023",
    "name": "senna",
    "categoryCode": "POWDER",
    "unitCode": "KG",
    "reorderLevel": 0.5,
    "trackExpiry": true
  },
  {
    "code": "POW-024",
    "name": "ajamo",
    "categoryCode": "POWDER",
    "unitCode": "KG",
    "reorderLevel": 0.5,
    "trackExpiry": true
  },
  {
    "code": "POW-025",
    "name": "sakar",
    "categoryCode": "POWDER",
    "unitCode": "KG",
    "reorderLevel": 0.5,
    "trackExpiry": true
  },
  {
    "code": "POW-026",
    "name": "jatamansi",
    "categoryCode": "POWDER",
    "unitCode": "KG",
    "reorderLevel": 0.5,
    "trackExpiry": true
  },
  {
    "code": "POW-027",
    "name": "kapoor kachari",
    "categoryCode": "POWDER",
    "unitCode": "KG",
    "reorderLevel": 0.5,
    "trackExpiry": true
  },
  {
    "code": "POW-028",
    "name": "Fenugreek",
    "categoryCode": "POWDER",
    "unitCode": "KG",
    "reorderLevel": 0.5,
    "trackExpiry": true
  },
  {
    "code": "POW-029",
    "name": "bhringraj",
    "categoryCode": "POWDER",
    "unitCode": "KG",
    "reorderLevel": 0.5,
    "trackExpiry": true
  },
  {
    "code": "POW-030",
    "name": "shikakai",
    "categoryCode": "POWDER",
    "unitCode": "KG",
    "reorderLevel": 0.5,
    "trackExpiry": true
  },
  {
    "code": "POW-031",
    "name": "nagarmotha",
    "categoryCode": "POWDER",
    "unitCode": "KG",
    "reorderLevel": 0.5,
    "trackExpiry": true
  },
  {
    "code": "POW-032",
    "name": "nag kesar",
    "categoryCode": "POWDER",
    "unitCode": "KG",
    "reorderLevel": 0.5,
    "trackExpiry": true
  },
  {
    "code": "POW-033",
    "name": "kamal kesar",
    "categoryCode": "POWDER",
    "unitCode": "KG",
    "reorderLevel": 0.5,
    "trackExpiry": true
  },
  {
    "code": "POW-034",
    "name": "aritha",
    "categoryCode": "POWDER",
    "unitCode": "KG",
    "reorderLevel": 0.5,
    "trackExpiry": true
  },
  {
    "code": "POW-035",
    "name": "brahmi",
    "categoryCode": "POWDER",
    "unitCode": "KG",
    "reorderLevel": 0.5,
    "trackExpiry": true
  },
  {
    "code": "POW-036",
    "name": "mustha",
    "categoryCode": "POWDER",
    "unitCode": "KG",
    "reorderLevel": 0.5,
    "trackExpiry": true
  },
  {
    "code": "POW-037",
    "name": "kesuda",
    "categoryCode": "POWDER",
    "unitCode": "KG",
    "reorderLevel": 0.5,
    "trackExpiry": true
  },
  {
    "code": "POW-038",
    "name": "aloe vera",
    "categoryCode": "POWDER",
    "unitCode": "KG",
    "reorderLevel": 0.5,
    "trackExpiry": true
  },
  {
    "code": "POW-039",
    "name": "wild termeric",
    "categoryCode": "POWDER",
    "unitCode": "KG",
    "reorderLevel": 0.5,
    "trackExpiry": true
  },
  {
    "code": "POW-040",
    "name": "multani mitti",
    "categoryCode": "POWDER",
    "unitCode": "KG",
    "reorderLevel": 0.5,
    "trackExpiry": true
  },
  {
    "code": "POW-041",
    "name": "kaolin clay",
    "categoryCode": "POWDER",
    "unitCode": "KG",
    "reorderLevel": 0.5,
    "trackExpiry": true
  },
  {
    "code": "POW-042",
    "name": "bentonite clay",
    "categoryCode": "POWDER",
    "unitCode": "KG",
    "reorderLevel": 0.5,
    "trackExpiry": true
  },
  {
    "code": "POW-043",
    "name": "loh bhashma",
    "categoryCode": "POWDER",
    "unitCode": "KG",
    "reorderLevel": 0.5,
    "trackExpiry": true
  },
  {
    "code": "POW-044",
    "name": "saffron",
    "categoryCode": "POWDER",
    "unitCode": "KG",
    "reorderLevel": 0.5,
    "trackExpiry": true
  },
  {
    "code": "POW-045",
    "name": "Dashamool",
    "categoryCode": "POWDER",
    "unitCode": "KG",
    "reorderLevel": 0.5,
    "trackExpiry": true
  },
  {
    "code": "POW-046",
    "name": "karanj",
    "categoryCode": "POWDER",
    "unitCode": "KG",
    "reorderLevel": 0.5,
    "trackExpiry": true
  },
  {
    "code": "POW-047",
    "name": "harade",
    "categoryCode": "POWDER",
    "unitCode": "KG",
    "reorderLevel": 0.5,
    "trackExpiry": true
  },
  {
    "code": "POW-048",
    "name": "baheda",
    "categoryCode": "POWDER",
    "unitCode": "KG",
    "reorderLevel": 0.5,
    "trackExpiry": true
  },
  {
    "code": "POW-049",
    "name": "apricot",
    "categoryCode": "POWDER",
    "unitCode": "KG",
    "reorderLevel": 0.5,
    "trackExpiry": true
  },
  {
    "code": "POW-050",
    "name": "Walnut",
    "categoryCode": "POWDER",
    "unitCode": "KG",
    "reorderLevel": 0.5,
    "trackExpiry": true
  },
  {
    "code": "CHE-001",
    "name": "DM water",
    "categoryCode": "CHEM",
    "unitCode": "L",
    "reorderLevel": 0.5,
    "trackExpiry": true
  },
  {
    "code": "CHE-002",
    "name": "disodium edta",
    "categoryCode": "CHEM",
    "unitCode": "L",
    "reorderLevel": 0.5,
    "trackExpiry": true
  },
  {
    "code": "CHE-003",
    "name": "polyquaternium 10",
    "categoryCode": "CHEM",
    "unitCode": "L",
    "reorderLevel": 0.5,
    "trackExpiry": true
  },
  {
    "code": "CHE-004",
    "name": "peg 150",
    "categoryCode": "CHEM",
    "unitCode": "L",
    "reorderLevel": 0.5,
    "trackExpiry": true
  },
  {
    "code": "CHE-005",
    "name": "capb",
    "categoryCode": "CHEM",
    "unitCode": "L",
    "reorderLevel": 0.5,
    "trackExpiry": true
  },
  {
    "code": "CHE-006",
    "name": "polysorbitol 20",
    "categoryCode": "CHEM",
    "unitCode": "L",
    "reorderLevel": 0.5,
    "trackExpiry": true
  },
  {
    "code": "CHE-007",
    "name": "coco glucoside",
    "categoryCode": "CHEM",
    "unitCode": "L",
    "reorderLevel": 0.5,
    "trackExpiry": true
  },
  {
    "code": "CHE-008",
    "name": "sles",
    "categoryCode": "CHEM",
    "unitCode": "L",
    "reorderLevel": 0.5,
    "trackExpiry": true
  },
  {
    "code": "CHE-009",
    "name": "decyl glucoside",
    "categoryCode": "CHEM",
    "unitCode": "L",
    "reorderLevel": 0.5,
    "trackExpiry": true
  },
  {
    "code": "CHE-010",
    "name": "peg 7",
    "categoryCode": "CHEM",
    "unitCode": "L",
    "reorderLevel": 0.5,
    "trackExpiry": true
  },
  {
    "code": "CHE-011",
    "name": "amodimethicon",
    "categoryCode": "CHEM",
    "unitCode": "L",
    "reorderLevel": 0.5,
    "trackExpiry": true
  },
  {
    "code": "CHE-012",
    "name": "d panthanol",
    "categoryCode": "CHEM",
    "unitCode": "L",
    "reorderLevel": 0.5,
    "trackExpiry": true
  },
  {
    "code": "CHE-013",
    "name": "pirocton olamine",
    "categoryCode": "CHEM",
    "unitCode": "L",
    "reorderLevel": 0.5,
    "trackExpiry": true
  },
  {
    "code": "CHE-014",
    "name": "glycerine",
    "categoryCode": "CHEM",
    "unitCode": "L",
    "reorderLevel": 0.5,
    "trackExpiry": true
  },
  {
    "code": "CHE-015",
    "name": "phynexoethenol",
    "categoryCode": "CHEM",
    "unitCode": "L",
    "reorderLevel": 0.5,
    "trackExpiry": true
  },
  {
    "code": "CHE-016",
    "name": "ipa 70",
    "categoryCode": "CHEM",
    "unitCode": "L",
    "reorderLevel": 0.5,
    "trackExpiry": true
  },
  {
    "code": "CHE-017",
    "name": "ipa 99",
    "categoryCode": "CHEM",
    "unitCode": "L",
    "reorderLevel": 0.5,
    "trackExpiry": true
  },
  {
    "code": "CHE-018",
    "name": "xanthum gum",
    "categoryCode": "CHEM",
    "unitCode": "L",
    "reorderLevel": 0.5,
    "trackExpiry": true
  },
  {
    "code": "CHE-019",
    "name": "stearic acid",
    "categoryCode": "CHEM",
    "unitCode": "L",
    "reorderLevel": 0.5,
    "trackExpiry": true
  },
  {
    "code": "CHE-020",
    "name": "naoh",
    "categoryCode": "CHEM",
    "unitCode": "L",
    "reorderLevel": 0.5,
    "trackExpiry": true
  },
  {
    "code": "CHE-021",
    "name": "niacinamide",
    "categoryCode": "CHEM",
    "unitCode": "L",
    "reorderLevel": 0.5,
    "trackExpiry": true
  },
  {
    "code": "CHE-022",
    "name": "Salicylic Acid",
    "categoryCode": "CHEM",
    "unitCode": "L",
    "reorderLevel": 0.5,
    "trackExpiry": true
  },
  {
    "code": "CHE-023",
    "name": "kojic acid",
    "categoryCode": "CHEM",
    "unitCode": "L",
    "reorderLevel": 0.5,
    "trackExpiry": true
  },
  {
    "code": "CHE-024",
    "name": "kojic acid dipalmated",
    "categoryCode": "CHEM",
    "unitCode": "L",
    "reorderLevel": 0.5,
    "trackExpiry": true
  },
  {
    "code": "CHE-025",
    "name": "Hyaluronic acid",
    "categoryCode": "CHEM",
    "unitCode": "L",
    "reorderLevel": 0.5,
    "trackExpiry": true
  },
  {
    "code": "CHE-026",
    "name": "Ethyl Ascorbic Acid 3-0",
    "categoryCode": "CHEM",
    "unitCode": "L",
    "reorderLevel": 0.5,
    "trackExpiry": true
  },
  {
    "code": "CHE-027",
    "name": "Alpha Arbutin",
    "categoryCode": "CHEM",
    "unitCode": "L",
    "reorderLevel": 0.5,
    "trackExpiry": true
  },
  {
    "code": "CHE-028",
    "name": "Allantoin",
    "categoryCode": "CHEM",
    "unitCode": "L",
    "reorderLevel": 0.5,
    "trackExpiry": true
  },
  {
    "code": "HYD-001",
    "name": "Rosemary",
    "categoryCode": "HYDRO",
    "unitCode": "L",
    "reorderLevel": 0.5,
    "trackExpiry": true
  },
  {
    "code": "HYD-002",
    "name": "rice",
    "categoryCode": "HYDRO",
    "unitCode": "L",
    "reorderLevel": 0.5,
    "trackExpiry": true
  },
  {
    "code": "HYD-003",
    "name": "potato",
    "categoryCode": "HYDRO",
    "unitCode": "L",
    "reorderLevel": 0.5,
    "trackExpiry": true
  },
  {
    "code": "HYD-004",
    "name": "rose",
    "categoryCode": "HYDRO",
    "unitCode": "L",
    "reorderLevel": 0.5,
    "trackExpiry": true
  },
  {
    "code": "HYD-005",
    "name": "alove vera",
    "categoryCode": "HYDRO",
    "unitCode": "L",
    "reorderLevel": 0.5,
    "trackExpiry": true
  },
  {
    "code": "FRA-001",
    "name": "medimix",
    "categoryCode": "FRAG",
    "unitCode": "L",
    "reorderLevel": 0.5,
    "trackExpiry": true
  },
  {
    "code": "FRA-002",
    "name": "sandalwood",
    "categoryCode": "FRAG",
    "unitCode": "L",
    "reorderLevel": 0.5,
    "trackExpiry": true
  },
  {
    "code": "FRA-003",
    "name": "lavendor",
    "categoryCode": "FRAG",
    "unitCode": "L",
    "reorderLevel": 0.5,
    "trackExpiry": true
  },
  {
    "code": "COL-001",
    "name": "green",
    "categoryCode": "COLOR",
    "unitCode": "L",
    "reorderLevel": 0.5,
    "trackExpiry": true
  },
  {
    "code": "COL-002",
    "name": "yellow",
    "categoryCode": "COLOR",
    "unitCode": "L",
    "reorderLevel": 0.5,
    "trackExpiry": true
  },
  {
    "code": "COL-003",
    "name": "brown",
    "categoryCode": "COLOR",
    "unitCode": "L",
    "reorderLevel": 0.5,
    "trackExpiry": true
  },
  {
    "code": "COL-004",
    "name": "orange",
    "categoryCode": "COLOR",
    "unitCode": "L",
    "reorderLevel": 0.5,
    "trackExpiry": true
  },
  {
    "code": "EXT-001",
    "name": "Rosemary",
    "categoryCode": "EXTRACT",
    "unitCode": "L",
    "reorderLevel": 0.5,
    "trackExpiry": true
  },
  {
    "code": "EXT-002",
    "name": "Bhringraj",
    "categoryCode": "EXTRACT",
    "unitCode": "L",
    "reorderLevel": 0.5,
    "trackExpiry": true
  },
  {
    "code": "EXT-003",
    "name": "Amla",
    "categoryCode": "EXTRACT",
    "unitCode": "L",
    "reorderLevel": 0.5,
    "trackExpiry": true
  },
  {
    "code": "EXT-004",
    "name": "Green Tea",
    "categoryCode": "EXTRACT",
    "unitCode": "L",
    "reorderLevel": 0.5,
    "trackExpiry": true
  },
  {
    "code": "EXT-005",
    "name": "Mulethi",
    "categoryCode": "EXTRACT",
    "unitCode": "L",
    "reorderLevel": 0.5,
    "trackExpiry": true
  },
  {
    "code": "EXT-006",
    "name": "Manjistha",
    "categoryCode": "EXTRACT",
    "unitCode": "L",
    "reorderLevel": 0.5,
    "trackExpiry": true
  },
  {
    "code": "EXT-007",
    "name": "Neem",
    "categoryCode": "EXTRACT",
    "unitCode": "L",
    "reorderLevel": 0.5,
    "trackExpiry": true
  },
  {
    "code": "EXT-008",
    "name": "Tulsi",
    "categoryCode": "EXTRACT",
    "unitCode": "L",
    "reorderLevel": 0.5,
    "trackExpiry": true
  },
  {
    "code": "EXT-009",
    "name": "Aloe Vera",
    "categoryCode": "EXTRACT",
    "unitCode": "L",
    "reorderLevel": 0.5,
    "trackExpiry": true
  },
  {
    "code": "EXT-010",
    "name": "Lodhra",
    "categoryCode": "EXTRACT",
    "unitCode": "L",
    "reorderLevel": 0.5,
    "trackExpiry": true
  },
  {
    "code": "EXT-011",
    "name": "Wild Turmeric",
    "categoryCode": "EXTRACT",
    "unitCode": "L",
    "reorderLevel": 0.5,
    "trackExpiry": true
  },
  {
    "code": "EXT-012",
    "name": "Rose Geranium",
    "categoryCode": "EXTRACT",
    "unitCode": "L",
    "reorderLevel": 0.5,
    "trackExpiry": true
  },
  {
    "code": "EXT-013",
    "name": "Mulberry",
    "categoryCode": "EXTRACT",
    "unitCode": "L",
    "reorderLevel": 0.5,
    "trackExpiry": true
  },
  {
    "code": "EXT-014",
    "name": "Bearberry",
    "categoryCode": "EXTRACT",
    "unitCode": "L",
    "reorderLevel": 0.5,
    "trackExpiry": true
  },
  {
    "code": "EXT-015",
    "name": "Sandalwood",
    "categoryCode": "EXTRACT",
    "unitCode": "L",
    "reorderLevel": 0.5,
    "trackExpiry": true
  },
  {
    "code": "EXT-016",
    "name": "Saffron",
    "categoryCode": "EXTRACT",
    "unitCode": "L",
    "reorderLevel": 0.5,
    "trackExpiry": true
  },
  {
    "code": "EXT-017",
    "name": "Fenugreek",
    "categoryCode": "EXTRACT",
    "unitCode": "L",
    "reorderLevel": 0.5,
    "trackExpiry": true
  },
  {
    "code": "EXT-018",
    "name": "Hibiscus Extract",
    "categoryCode": "EXTRACT",
    "unitCode": "L",
    "reorderLevel": 0.5,
    "trackExpiry": true
  },
  {
    "code": "EXT-019",
    "name": "Jatamansi",
    "categoryCode": "EXTRACT",
    "unitCode": "L",
    "reorderLevel": 0.5,
    "trackExpiry": true
  },
  {
    "code": "EXT-020",
    "name": "Lemongrass",
    "categoryCode": "EXTRACT",
    "unitCode": "L",
    "reorderLevel": 0.5,
    "trackExpiry": true
  },
  {
    "code": "EXT-021",
    "name": "rice",
    "categoryCode": "EXTRACT",
    "unitCode": "L",
    "reorderLevel": 0.5,
    "trackExpiry": true
  },
  {
    "code": "EXT-022",
    "name": "potato",
    "categoryCode": "EXTRACT",
    "unitCode": "L",
    "reorderLevel": 0.5,
    "trackExpiry": true
  },
  {
    "code": "EO-001",
    "name": "Sandalwood",
    "categoryCode": "EO",
    "unitCode": "L",
    "reorderLevel": 0.2,
    "trackExpiry": true
  },
  {
    "code": "EO-002",
    "name": "tea tree",
    "categoryCode": "EO",
    "unitCode": "L",
    "reorderLevel": 0.2,
    "trackExpiry": true
  },
  {
    "code": "EO-003",
    "name": "frankinsence",
    "categoryCode": "EO",
    "unitCode": "L",
    "reorderLevel": 0.2,
    "trackExpiry": true
  },
  {
    "code": "EO-004",
    "name": "vitamin E",
    "categoryCode": "EO",
    "unitCode": "L",
    "reorderLevel": 0.2,
    "trackExpiry": true
  },
  {
    "code": "EO-005",
    "name": "ORANGE",
    "categoryCode": "EO",
    "unitCode": "L",
    "reorderLevel": 0.2,
    "trackExpiry": true
  },
  {
    "code": "EO-006",
    "name": "LEMON",
    "categoryCode": "EO",
    "unitCode": "L",
    "reorderLevel": 0.2,
    "trackExpiry": true
  },
  {
    "code": "EO-007",
    "name": "Basil",
    "categoryCode": "EO",
    "unitCode": "L",
    "reorderLevel": 0.2,
    "trackExpiry": true
  },
  {
    "code": "EO-008",
    "name": "Lemon grass",
    "categoryCode": "EO",
    "unitCode": "L",
    "reorderLevel": 0.2,
    "trackExpiry": true
  },
  {
    "code": "EO-009",
    "name": "Peppermint",
    "categoryCode": "EO",
    "unitCode": "L",
    "reorderLevel": 0.2,
    "trackExpiry": true
  },
  {
    "code": "EO-010",
    "name": "Vetiver",
    "categoryCode": "EO",
    "unitCode": "L",
    "reorderLevel": 0.2,
    "trackExpiry": true
  },
  {
    "code": "EO-011",
    "name": "Ylang Ylang",
    "categoryCode": "EO",
    "unitCode": "L",
    "reorderLevel": 0.2,
    "trackExpiry": true
  },
  {
    "code": "EO-012",
    "name": "Rose Geranium",
    "categoryCode": "EO",
    "unitCode": "L",
    "reorderLevel": 0.2,
    "trackExpiry": true
  },
  {
    "code": "EO-013",
    "name": "WILD TERMERIC",
    "categoryCode": "EO",
    "unitCode": "L",
    "reorderLevel": 0.2,
    "trackExpiry": true
  },
  {
    "code": "EO-014",
    "name": "LEVENDOR",
    "categoryCode": "EO",
    "unitCode": "L",
    "reorderLevel": 0.2,
    "trackExpiry": true
  },
  {
    "code": "EO-015",
    "name": "ROSEMARY",
    "categoryCode": "EO",
    "unitCode": "L",
    "reorderLevel": 0.2,
    "trackExpiry": true
  },
  {
    "code": "EO-016",
    "name": "CEDARWOOD",
    "categoryCode": "EO",
    "unitCode": "L",
    "reorderLevel": 0.2,
    "trackExpiry": true
  },
  {
    "code": "EO-017",
    "name": "Carrot Seed",
    "categoryCode": "EO",
    "unitCode": "L",
    "reorderLevel": 0.2,
    "trackExpiry": true
  },
  {
    "code": "OIL-001",
    "name": "Black Seseme",
    "categoryCode": "BASEOIL",
    "unitCode": "L",
    "reorderLevel": 0.0,
    "trackExpiry": true
  },
  {
    "code": "OIL-002",
    "name": "Coconut",
    "categoryCode": "BASEOIL",
    "unitCode": "L",
    "reorderLevel": 0.0,
    "trackExpiry": true
  },
  {
    "code": "OIL-003",
    "name": "Castor",
    "categoryCode": "BASEOIL",
    "unitCode": "L",
    "reorderLevel": 0.0,
    "trackExpiry": true
  },
  {
    "code": "OIL-004",
    "name": "Musterd",
    "categoryCode": "BASEOIL",
    "unitCode": "L",
    "reorderLevel": 0.0,
    "trackExpiry": true
  },
  {
    "code": "OIL-005",
    "name": "Avacado",
    "categoryCode": "BASEOIL",
    "unitCode": "L",
    "reorderLevel": 0.0,
    "trackExpiry": true
  },
  {
    "code": "OIL-006",
    "name": "Kalonji",
    "categoryCode": "BASEOIL",
    "unitCode": "L",
    "reorderLevel": 0.0,
    "trackExpiry": true
  },
  {
    "code": "OIL-007",
    "name": "Sweet Almond",
    "categoryCode": "BASEOIL",
    "unitCode": "L",
    "reorderLevel": 0.0,
    "trackExpiry": true
  },
  {
    "code": "OIL-008",
    "name": "Jojoba",
    "categoryCode": "BASEOIL",
    "unitCode": "L",
    "reorderLevel": 0.0,
    "trackExpiry": true
  },
  {
    "code": "OIL-009",
    "name": "Rice Bran",
    "categoryCode": "BASEOIL",
    "unitCode": "L",
    "reorderLevel": 0.0,
    "trackExpiry": true
  },
  {
    "code": "OIL-010",
    "name": "Roschip Seed",
    "categoryCode": "BASEOIL",
    "unitCode": "L",
    "reorderLevel": 0.0,
    "trackExpiry": true
  },
  {
    "code": "OIL-011",
    "name": "Argan",
    "categoryCode": "BASEOIL",
    "unitCode": "L",
    "reorderLevel": 0.0,
    "trackExpiry": true
  },
  {
    "code": "OIL-012",
    "name": "Apricot",
    "categoryCode": "BASEOIL",
    "unitCode": "L",
    "reorderLevel": 0.0,
    "trackExpiry": true
  },
  {
    "code": "CLA-001",
    "name": "Multani mitti",
    "categoryCode": "CLAY",
    "unitCode": "KG",
    "reorderLevel": 0.5,
    "trackExpiry": true
  },
  {
    "code": "CLA-002",
    "name": "Kaolin clay",
    "categoryCode": "CLAY",
    "unitCode": "KG",
    "reorderLevel": 0.5,
    "trackExpiry": true
  },
  {
    "code": "CLA-003",
    "name": "bentonite clay",
    "categoryCode": "CLAY",
    "unitCode": "KG",
    "reorderLevel": 0.5,
    "trackExpiry": true
  },
  {
    "code": "CLA-004",
    "name": "Calamine clay",
    "categoryCode": "CLAY",
    "unitCode": "KG",
    "reorderLevel": 0.5,
    "trackExpiry": true
  },
  {
    "code": "SBA-001",
    "name": "Glycerine",
    "categoryCode": "SOAPBASE",
    "unitCode": "L",
    "reorderLevel": 5.0,
    "trackExpiry": true
  },
  {
    "code": "SBA-002",
    "name": "Goat Milk",
    "categoryCode": "SOAPBASE",
    "unitCode": "L",
    "reorderLevel": 5.0,
    "trackExpiry": true
  },
  {
    "code": "PKG-001",
    "name": "Oil 100",
    "categoryCode": "PACKAGING",
    "unitCode": "PCS",
    "reorderLevel": 100.0,
    "trackExpiry": false
  },
  {
    "code": "PKG-002",
    "name": "Oil 200",
    "categoryCode": "PACKAGING",
    "unitCode": "PCS",
    "reorderLevel": 100.0,
    "trackExpiry": false
  },
  {
    "code": "PKG-003",
    "name": "Shampoo 200",
    "categoryCode": "PACKAGING",
    "unitCode": "PCS",
    "reorderLevel": 100.0,
    "trackExpiry": false
  },
  {
    "code": "PKG-004",
    "name": "shampoo 250",
    "categoryCode": "PACKAGING",
    "unitCode": "PCS",
    "reorderLevel": 100.0,
    "trackExpiry": false
  },
  {
    "code": "PKG-005",
    "name": "Gel jar 200",
    "categoryCode": "PACKAGING",
    "unitCode": "PCS",
    "reorderLevel": 100.0,
    "trackExpiry": false
  },
  {
    "code": "PKG-006",
    "name": "gel jar 300",
    "categoryCode": "PACKAGING",
    "unitCode": "PCS",
    "reorderLevel": 100.0,
    "trackExpiry": false
  },
  {
    "code": "PKG-007",
    "name": "cream jar 15",
    "categoryCode": "PACKAGING",
    "unitCode": "PCS",
    "reorderLevel": 100.0,
    "trackExpiry": false
  },
  {
    "code": "PKG-008",
    "name": "cram jar 25",
    "categoryCode": "PACKAGING",
    "unitCode": "PCS",
    "reorderLevel": 100.0,
    "trackExpiry": false
  },
  {
    "code": "PKG-009",
    "name": "hair sprey 100",
    "categoryCode": "PACKAGING",
    "unitCode": "PCS",
    "reorderLevel": 100.0,
    "trackExpiry": false
  },
  {
    "code": "PKG-010",
    "name": "standup 50",
    "categoryCode": "PACKAGING",
    "unitCode": "PCS",
    "reorderLevel": 100.0,
    "trackExpiry": false
  },
  {
    "code": "PKG-011",
    "name": "standup 100",
    "categoryCode": "PACKAGING",
    "unitCode": "PCS",
    "reorderLevel": 100.0,
    "trackExpiry": false
  },
  {
    "code": "PKG-012",
    "name": "standup 200",
    "categoryCode": "PACKAGING",
    "unitCode": "PCS",
    "reorderLevel": 100.0,
    "trackExpiry": false
  },
  {
    "code": "PKG-013",
    "name": "soap heat shrink",
    "categoryCode": "PACKAGING",
    "unitCode": "PCS",
    "reorderLevel": 100.0,
    "trackExpiry": false
  },
  {
    "code": "PKG-014",
    "name": "bottle heat shrink",
    "categoryCode": "PACKAGING",
    "unitCode": "PCS",
    "reorderLevel": 100.0,
    "trackExpiry": false
  },
  {
    "code": "PKG-015",
    "name": "Parcel Box",
    "categoryCode": "PACKAGING",
    "unitCode": "PCS",
    "reorderLevel": 100.0,
    "trackExpiry": false
  },
  {
    "code": "PKG-016",
    "name": "Tap",
    "categoryCode": "PACKAGING",
    "unitCode": "PCS",
    "reorderLevel": 100.0,
    "trackExpiry": false
  },
  {
    "code": "HER-001",
    "name": "Rosemary",
    "categoryCode": "HERB",
    "unitCode": "KG",
    "reorderLevel": 0.2,
    "trackExpiry": true
  },
  {
    "code": "HER-002",
    "name": "white Sandalwood",
    "categoryCode": "HERB",
    "unitCode": "KG",
    "reorderLevel": 0.2,
    "trackExpiry": true
  },
  {
    "code": "HER-003",
    "name": "red sandalwood",
    "categoryCode": "HERB",
    "unitCode": "KG",
    "reorderLevel": 0.2,
    "trackExpiry": true
  },
  {
    "code": "HER-004",
    "name": "licorice / mulethi",
    "categoryCode": "HERB",
    "unitCode": "KG",
    "reorderLevel": 0.2,
    "trackExpiry": true
  },
  {
    "code": "HER-005",
    "name": "bhringraj",
    "categoryCode": "HERB",
    "unitCode": "KG",
    "reorderLevel": 0.2,
    "trackExpiry": true
  },
  {
    "code": "HER-006",
    "name": "bhrahmi",
    "categoryCode": "HERB",
    "unitCode": "KG",
    "reorderLevel": 0.2,
    "trackExpiry": true
  },
  {
    "code": "HER-007",
    "name": "amala",
    "categoryCode": "HERB",
    "unitCode": "KG",
    "reorderLevel": 0.2,
    "trackExpiry": true
  },
  {
    "code": "HER-008",
    "name": "manjishtha",
    "categoryCode": "HERB",
    "unitCode": "KG",
    "reorderLevel": 0.2,
    "trackExpiry": true
  },
  {
    "code": "HER-009",
    "name": "vacha",
    "categoryCode": "HERB",
    "unitCode": "KG",
    "reorderLevel": 0.2,
    "trackExpiry": true
  },
  {
    "code": "HER-010",
    "name": "kadava neem",
    "categoryCode": "HERB",
    "unitCode": "KG",
    "reorderLevel": 0.2,
    "trackExpiry": true
  },
  {
    "code": "HER-011",
    "name": "Curry Neem",
    "categoryCode": "HERB",
    "unitCode": "KG",
    "reorderLevel": 0.2,
    "trackExpiry": true
  },
  {
    "code": "HER-012",
    "name": "vadvai",
    "categoryCode": "HERB",
    "unitCode": "KG",
    "reorderLevel": 0.2,
    "trackExpiry": true
  },
  {
    "code": "HER-013",
    "name": "hibiscus",
    "categoryCode": "HERB",
    "unitCode": "KG",
    "reorderLevel": 0.2,
    "trackExpiry": true
  },
  {
    "code": "HER-014",
    "name": "chanothi / gunja",
    "categoryCode": "HERB",
    "unitCode": "KG",
    "reorderLevel": 0.2,
    "trackExpiry": true
  },
  {
    "code": "HER-015",
    "name": "Indrayana beej",
    "categoryCode": "HERB",
    "unitCode": "KG",
    "reorderLevel": 0.2,
    "trackExpiry": true
  },
  {
    "code": "HER-016",
    "name": "orange peel",
    "categoryCode": "HERB",
    "unitCode": "KG",
    "reorderLevel": 0.2,
    "trackExpiry": true
  },
  {
    "code": "HER-017",
    "name": "lemon peel",
    "categoryCode": "HERB",
    "unitCode": "KG",
    "reorderLevel": 0.2,
    "trackExpiry": true
  },
  {
    "code": "HER-018",
    "name": "rose",
    "categoryCode": "HERB",
    "unitCode": "KG",
    "reorderLevel": 0.2,
    "trackExpiry": true
  },
  {
    "code": "FG-001",
    "name": "Hair oil ( hair re growth )",
    "categoryCode": "FINISHED",
    "unitCode": "PCS",
    "reorderLevel": 10.0,
    "trackExpiry": true
  },
  {
    "code": "FG-002",
    "name": "hair oil ( anti hari fall )",
    "categoryCode": "FINISHED",
    "unitCode": "PCS",
    "reorderLevel": 10.0,
    "trackExpiry": true
  },
  {
    "code": "FG-003",
    "name": "shampoo ( anti hair fall )",
    "categoryCode": "FINISHED",
    "unitCode": "PCS",
    "reorderLevel": 10.0,
    "trackExpiry": true
  },
  {
    "code": "FG-004",
    "name": "shampoo ( rice protein )",
    "categoryCode": "FINISHED",
    "unitCode": "PCS",
    "reorderLevel": 10.0,
    "trackExpiry": true
  },
  {
    "code": "FG-005",
    "name": "shampoo ( keratin )",
    "categoryCode": "FINISHED",
    "unitCode": "PCS",
    "reorderLevel": 10.0,
    "trackExpiry": true
  },
  {
    "code": "FG-006",
    "name": "sandalwood soap",
    "categoryCode": "FINISHED",
    "unitCode": "PCS",
    "reorderLevel": 10.0,
    "trackExpiry": true
  },
  {
    "code": "FG-007",
    "name": "haldi chandan soap",
    "categoryCode": "FINISHED",
    "unitCode": "PCS",
    "reorderLevel": 10.0,
    "trackExpiry": true
  },
  {
    "code": "FG-008",
    "name": "neem tusli soap",
    "categoryCode": "FINISHED",
    "unitCode": "PCS",
    "reorderLevel": 10.0,
    "trackExpiry": true
  },
  {
    "code": "FG-009",
    "name": "d tan soap",
    "categoryCode": "FINISHED",
    "unitCode": "PCS",
    "reorderLevel": 10.0,
    "trackExpiry": true
  },
  {
    "code": "FG-010",
    "name": "ubtan soap",
    "categoryCode": "FINISHED",
    "unitCode": "PCS",
    "reorderLevel": 10.0,
    "trackExpiry": true
  },
  {
    "code": "FG-011",
    "name": "rice potato soap",
    "categoryCode": "FINISHED",
    "unitCode": "PCS",
    "reorderLevel": 10.0,
    "trackExpiry": true
  },
  {
    "code": "FG-012",
    "name": "kesuda soap",
    "categoryCode": "FINISHED",
    "unitCode": "PCS",
    "reorderLevel": 10.0,
    "trackExpiry": true
  },
  {
    "code": "FG-013",
    "name": "hydra glow soap",
    "categoryCode": "FINISHED",
    "unitCode": "PCS",
    "reorderLevel": 10.0,
    "trackExpiry": true
  },
  {
    "code": "FG-014",
    "name": "charcol soap",
    "categoryCode": "FINISHED",
    "unitCode": "PCS",
    "reorderLevel": 10.0,
    "trackExpiry": true
  },
  {
    "code": "FG-015",
    "name": "sandalwood face pack (dry )",
    "categoryCode": "FINISHED",
    "unitCode": "PCS",
    "reorderLevel": 10.0,
    "trackExpiry": true
  },
  {
    "code": "FG-016",
    "name": "kumkumadi face pack ( dry )",
    "categoryCode": "FINISHED",
    "unitCode": "PCS",
    "reorderLevel": 10.0,
    "trackExpiry": true
  },
  {
    "code": "FG-017",
    "name": "ubtan pack dry",
    "categoryCode": "FINISHED",
    "unitCode": "PCS",
    "reorderLevel": 10.0,
    "trackExpiry": true
  },
  {
    "code": "FG-018",
    "name": "hydra glow gel",
    "categoryCode": "FINISHED",
    "unitCode": "PCS",
    "reorderLevel": 10.0,
    "trackExpiry": true
  },
  {
    "code": "FG-019",
    "name": "alove vera dtan gel",
    "categoryCode": "FINISHED",
    "unitCode": "PCS",
    "reorderLevel": 10.0,
    "trackExpiry": true
  },
  {
    "code": "FG-020",
    "name": "aloe vera gel",
    "categoryCode": "FINISHED",
    "unitCode": "PCS",
    "reorderLevel": 10.0,
    "trackExpiry": true
  },
  {
    "code": "FG-021",
    "name": "avacado cream",
    "categoryCode": "FINISHED",
    "unitCode": "PCS",
    "reorderLevel": 10.0,
    "trackExpiry": true
  },
  {
    "code": "FG-022",
    "name": "bridal cream",
    "categoryCode": "FINISHED",
    "unitCode": "PCS",
    "reorderLevel": 10.0,
    "trackExpiry": true
  },
  {
    "code": "FG-023",
    "name": "anti dandraff hair pack ( dry )",
    "categoryCode": "FINISHED",
    "unitCode": "PCS",
    "reorderLevel": 10.0,
    "trackExpiry": true
  },
  {
    "code": "FG-024",
    "name": "hair pack ( dry ) ( all in one )",
    "categoryCode": "FINISHED",
    "unitCode": "PCS",
    "reorderLevel": 10.0,
    "trackExpiry": true
  },
  {
    "code": "FG-025",
    "name": "rosemary hair growth sprey 120 ml",
    "categoryCode": "FINISHED",
    "unitCode": "PCS",
    "reorderLevel": 10.0,
    "trackExpiry": true
  },
  {
    "code": "FG-026",
    "name": "kumdumadi face oil",
    "categoryCode": "FINISHED",
    "unitCode": "PCS",
    "reorderLevel": 10.0,
    "trackExpiry": true
  },
  {
    "code": "FG-027",
    "name": "kumkumadi face serum",
    "categoryCode": "FINISHED",
    "unitCode": "PCS",
    "reorderLevel": 10.0,
    "trackExpiry": true
  },
  {
    "code": "FG-028",
    "name": "htdra glow seruum",
    "categoryCode": "FINISHED",
    "unitCode": "PCS",
    "reorderLevel": 10.0,
    "trackExpiry": true
  },
  {
    "code": "FG-029",
    "name": "toner",
    "categoryCode": "FINISHED",
    "unitCode": "PCS",
    "reorderLevel": 10.0,
    "trackExpiry": true
  }
];

function normalizedName(value) {
  return String(value || "").trim().toLowerCase();
}

export function seedRiseoraCatalog() {
  const insertCategory = db.prepare(`
    INSERT INTO item_categories (
      code,
      name,
      inventory_role
    )
    VALUES (?, ?, ?)
    ON CONFLICT(code) DO UPDATE SET
      inventory_role = excluded.inventory_role,
      updated_at = CURRENT_TIMESTAMP
  `);

  const getCategory = db.prepare(`
    SELECT id, code, inventory_role
    FROM item_categories
    WHERE code = ?
  `);

  const getUnit = db.prepare(`
    SELECT id, code
    FROM units
    WHERE code = ?
      AND is_active = 1
  `);

  const getItemByCode = db.prepare(`
    SELECT id
    FROM items
    WHERE code = ?
  `);

  const getItemByNameAndCategory = db.prepare(`
    SELECT i.id
    FROM items i
    WHERE i.category_id = ?
      AND LOWER(TRIM(i.name)) = ?
    LIMIT 1
  `);

  const insertItem = db.prepare(`
    INSERT INTO items (
      code,
      name,
      category_id,
      base_unit_id,
      reorder_level,
      track_lot,
      track_expiry,
      density,
      default_selling_price,
      target_margin_percent,
      hsn_code,
      default_gst_rate,
      notes,
      is_active
    )
    VALUES (?, ?, ?, ?, ?, 0, ?, NULL, 0, 0, NULL, 0, ?, 1)
  `);

  const transaction = db.transaction(() => {
    for (const category of CATEGORIES) {
      insertCategory.run(category.code, category.name, category.inventoryRole);
    }

    let inserted = 0;
    let skipped = 0;

    for (const item of ITEMS) {
      const category = getCategory.get(item.categoryCode);
      const unit = getUnit.get(item.unitCode);

      if (!category || !unit) {
        throw new Error(
          `Riseora catalog seed could not resolve category ${item.categoryCode} or unit ${item.unitCode} for ${item.name}.`,
        );
      }

      const existingByCode = getItemByCode.get(item.code);
      const existingByName = getItemByNameAndCategory.get(
        category.id,
        normalizedName(item.name),
      );

      if (existingByCode || existingByName) {
        skipped += 1;
        continue;
      }

      insertItem.run(
        item.code,
        item.name,
        category.id,
        unit.id,
        Number(item.reorderLevel || 0),
        item.trackExpiry ? 1 : 0,
        `Default Riseora owner catalog · Source group: ${category.code}`,
      );
      inserted += 1;
    }

    return { inserted, skipped };
  });

  const result = transaction();
  console.log(
    `Riseora default catalog seeded: ${result.inserted} added, ${result.skipped} already present.`,
  );
}
