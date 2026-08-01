/**
 * COE curriculum used to build the library folder tree.
 *
 * Transcribed verbatim from `CURRICULUM_SUBJECTS` and `COURSE_FOLDERS` in the
 * existing portal (`enhanced-library.js`), so the seeded tree matches the
 * structure students already navigate. Keep this file as the single source of
 * truth — edit here, re-run the seed, and the tree updates.
 */

export const COURSES = [
  { code: "CE", name: "Civil Engineering" },
  { code: "EE", name: "Electrical Engineering" },
] as const;

export const YEARS = ["1st Year", "2nd Year", "3rd Year", "4th Year"] as const;

/**
 * Material categories created beneath every subject. Mirrors
 * `MATERIAL_CATEGORIES` in the portal.
 */
export const CATEGORIES = [
  { name: "Reference Books", kind: "REFERENCE", icon: "book" },
  { name: "Handouts", kind: "HANDOUT", icon: "description" },
  { name: "Video Lectures", kind: "VIDEO", icon: "play_circle" },
  { name: "Lessons", kind: "LESSON", icon: "school" },
  { name: "Google Drive Links", kind: "LINK", icon: "link" },
] as const;

export const CURRICULUM: Record<string, Record<string, string[]>> = {
  CE: {
    "1st Year": [
      "MAT 171 - CALCULUS 1",
      "PHY 032 - PHYSICS FOR ENGINEERS",
      "MAT 076 - CALCULUS 2",
    ],
    "2nd Year": [
      "BES 025 - STATICS OF RIGID BODIES",
      "MAT 052 - DIFFERENTIAL EQUATION",
      "CIE 112 - FUNDAMENTALS OF SURVEYING",
      "ECO 017 - ENGINEERING ECONOMICS",
      "CIE 113 - MECHANICS OF DEFORMABLE BODIES",
      "BES 026 - DYNAMICS OF RIGID BODIES",
    ],
    "3rd Year": [
      "ECE 069 - ENGINEERING DATA ANALYSIS",
      "CIE 136 - STRUCTURAL THEORY",
      "CIE 115 - NUMERICAL SOLUTIONS TO CE PROBLEMS",
      "CIE 120 - PRINCIPLE OF REINFORCED/PRESTRESSED CONCRETE",
      "CIE 119 - PRINCIPLE OF STEEL DESIGN",
      "CIE 121 - HYDRAULICS",
    ],
    "4th Year": [
      "CIE 097 - PROFESSIONAL COURSE SPECIALIZED 1: BRIDGE DESIGN",
      "CIE 128 - PRINCIPLE OF TRANSPORTATION ENGINEERING",
      "CIE 031 - PROF COURSE SPECIALIZED 3: STRUCTURAL DESIGN OF STEEL",
      "CIE 131 - PROF COURSE 4: FOUNDATIONAL AND RETAINING WALL DESIGN",
    ],
  },
  EE: {
    "1st Year": [
      "OE 025 - CHEMISTRY FOR ENGINEERS",
      "MAT 171 - CALCULUS 1 FOR ENGINEERS",
      "PHY 032 - PHYSICS 1 FOR ENGINEERS",
      "MAT 076 - CALCULUS 2",
    ],
    "2nd Year": [
      "BES 058 - ENGINEERING MECHANICS",
      "ECE 069 - ENGINEERING DATA ANALYSIS",
      "ELE 001 - ELECTRICAL CIRCUITS 1",
      "ITE 296 - COMPUTER PROGRAMMING",
      "MAT 052 - DIFFERENTIAL EQUATIONS",
      "MEE 085 - BASIC THERMODYNAMICS",
      "BES 024 - COMPUTER-AIDED DRAFTING",
      "BES 059 - FUNDAMENTALS OF DEFORMABLE BODIES",
      "ELE 002 - ELECTRICAL CIRCUITS 2",
      "ELE 117 - ELECTROMAGNETICS",
      "ELE 031 - ELECTRONIC CIRCUITS: DEVICES AND ANALYSIS",
      "MAT 168 - ENGINEERING MATH FOR EE",
    ],
    "3rd Year": [
      "BES 060 - FLUID MECHANICS",
      "BES 061 - ENVIRONMENTAL SCIENCE AND ENGINEERING",
      "ELE 032 - INDUSTRIAL ELECTRONICS",
      "ELE 094 - MATERIALS SCIENCE AND ENGINEERING",
      "ELE 095 - FUNDAMENTALS OF ELECTRONIC COMMUNICATIONS",
      "ELE 096 - ELECTRICAL MACHINES 1",
      "ITE 296 - LOGIC CIRCUITS AND SWITCHING THEORY",
      "MAT 169 - NUMERICAL METHODS AND ANALYSIS",
      "BES 057 - BASIC OCCUPATIONAL SAFETY AND HEALTH",
      "ECO 017 - ENGINEERING ECONOMICS",
      "ELE 017 - EE LAWS, CODES, AND PROFESSIONAL ETHICS",
      "ELE 097 - MICROPROCESSOR SYSTEMS",
      "ELE 098 - ELECTRICAL APPARATUS AND DEVICES",
      "ELE 099 - ELECTRICAL MACHINES 2",
      "ELE 101 - FEEDBACK CONTROL SYSTEMS",
    ],
    // Intentionally empty in the source curriculum — no 4th-year EE subjects
    // are listed yet. The year folder is still created so uploads have a home.
    "4th Year": [],
  },
};
