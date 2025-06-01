import React from "react";
import Header from "./Header";
import Sidebar from "./Sidebar";

const Base = ({ children }) => {
  return (
    <div style={styles.container}>
      <Sidebar />
      <div style={styles.main}>
        <Header />
        <div style={styles.content}>{children}</div>
      </div>
    </div>
  );
};

const styles = {
  container: { display: "flex", height: "100vh", marginLeft : "160px", },
  main: { flex: 1, display: "flex", flexDirection: "column" },
  content: { flex: 1, padding: "0px", backgroundColor: "#f9f9f9", },
};

export default Base;
