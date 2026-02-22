import { StyleSheet } from "@react-pdf/renderer";

export function createStyles(fontSize = 10, lineHeight = 1.3) {
  return StyleSheet.create({
    page: {
      fontFamily: "EBGaramond",
      fontSize,
      paddingTop: 24,
      paddingBottom: 24,
      paddingHorizontal: 36,
      lineHeight,
      color: "#1a1a1a",
    },
    header: {
      textAlign: "center",
      marginBottom: 6,
    },
    name: {
      fontSize: fontSize + 8,
      fontWeight: "bold",
      marginBottom: 2,
      color: "#000000",
    },
    contactRow: {
      fontSize: fontSize - 1,
      color: "#333333",
      flexDirection: "row",
      justifyContent: "center",
      flexWrap: "wrap",
      gap: 4,
    },
    contactSeparator: {
      color: "#999999",
    },
    sectionTitle: {
      fontSize: fontSize + 1,
      fontWeight: "bold",
      textTransform: "uppercase",
      borderBottomWidth: 0.75,
      borderBottomColor: "#000000",
      marginTop: 6,
      marginBottom: 3,
      paddingBottom: 1,
      letterSpacing: 0.5,
    },
    entryRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "baseline",
      marginBottom: 1,
    },
    entryLeft: {
      flexDirection: "row",
      flexShrink: 1,
      maxWidth: "70%",
    },
    companyName: {
      fontSize,
      fontWeight: "bold",
    },
    titleSeparator: {
      fontSize,
      fontWeight: "bold",
      marginHorizontal: 3,
    },
    jobTitle: {
      fontSize,
      fontStyle: "italic",
    },
    dateLocation: {
      fontSize: fontSize - 1,
      fontStyle: "italic",
      color: "#444444",
      textAlign: "right",
    },
    experienceEntry: {
      marginBottom: 4,
    },
    bullet: {
      flexDirection: "row",
      marginBottom: 1,
      paddingLeft: 8,
    },
    bulletDot: {
      width: 8,
      fontSize,
    },
    bulletText: {
      flex: 1,
      fontSize: fontSize - 0.5,
    },
    skillsRow: {
      fontSize: fontSize - 0.5,
      marginTop: 1,
    },
    projectTechRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "baseline",
      marginBottom: 1,
    },
    projectName: {
      fontSize,
      fontWeight: "bold",
    },
    projectTech: {
      fontSize: fontSize - 1,
      fontStyle: "italic",
      color: "#444444",
    },
    educationRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "baseline",
      marginBottom: 2,
    },
    educationDegree: {
      fontSize,
      fontWeight: "bold",
    },
    educationDetails: {
      fontSize: fontSize - 1,
      color: "#444444",
      marginTop: 1,
    },
  });
}
