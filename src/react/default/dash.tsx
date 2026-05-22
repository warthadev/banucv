import React from "react";
import { motion } from "framer-motion";
import { heroVariants } from "@/react/animation/home";

const Dash: React.FC = () => {
  const currentYear = new Date().getFullYear();

  return (
    <div className="home-container">
      <main className="home-hero">
        <motion.div
          variants={heroVariants}
          initial="initial"
          animate="animate"
          style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}
        >
          <h1 className="home-subtitle1"> Cari Apa, Kosong Bruhh!</h1>
          <p className="home-subtitle">
            Sabar ya, ini lagi digarap biar gacor. 
            Mending ngopi dulu gih, nanti balik lagi kalau udah kelar!
          </p>
        </motion.div>
      </main>

      <footer className="home-footer">
        <p>© {currentYear} WarthaDev • Engineering with Passion</p>
      </footer>
    </div>
  );
};

export default Dash;
