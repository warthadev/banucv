// src/react/default/navbar.tsx
import React from "react";
import { Link, useLocation } from "react-router-dom";
import { FiLogIn, FiUser, FiLogOut } from "react-icons/fi";
import { motion, AnimatePresence } from "framer-motion";
import { useNavbar } from "@hook/usenavbar";
import { navLinks, hamburgerVariants, dropdownVariants } from "@config/navconfig";
import { useAudio } from "@hook/useaudio";

// path Navbar: komponen navigasi utama
const Navbar: React.FC = () => {
  const location = useLocation();
  const { setIsPlaying } = useAudio();

  const {
    isLoggedIn,
    isMenuOpen,
    isHomePage,
    showNavAndHamburger,
    handleLogout,
    toggleMenu,
    closeMenu
  } = useNavbar();

  const handleFullLogout = () => {
    setIsPlaying(false);
    handleLogout();
  };

  return (
    <header className="nav-header">
      <div className="nav-container-main">
        <Link to="/dashboard" className="nav-logo">
          <span>WARTHACV</span>
        </Link>

        {showNavAndHamburger && (
          <nav className="desktop-center-nav">
            <ul className="nav-links-list">
              {navLinks.map((link) => {
                const isActive = location.pathname === link.to;
                return (
                  <li key={link.to}>
                    <Link 
                      to={link.to} 
                      className={`nav-item-link ${isActive ? 'active-page' : ''}`}
                    >
                      <link.icon size={18} /> 
                      <span className="link-text-visible">{link.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        )}

        <nav className="nav">
          {!isLoggedIn ? (
            <Link to="/login" className="home-nav-link">
              <FiLogIn />
              <span>Sign In</span>
            </Link>
          ) : (
            <div onClick={handleFullLogout} className="home-nav-link pointer" role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && handleFullLogout()}>
              <FiLogOut />
              <span className="auth-text-visible">Logout</span>
            </div>
          )}

          {isHomePage && (
            <Link to="/dashboard" className="nav-btn-dash">
              <FiUser />
              <span className="auth-text-visible">Open CV</span>
            </Link>
          )}

          {showNavAndHamburger && (
            <motion.div 
              className="nav-hamburger" 
              onClick={toggleMenu} 
              animate={isMenuOpen ? "opened" : "closed"}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && toggleMenu()}
              aria-label="Menu"
            >
              <motion.span variants={hamburgerVariants.line1} transition={{ duration: 0.2 }} />
              <motion.span variants={hamburgerVariants.line2} transition={{ duration: 0.05 }} />
              <motion.span variants={hamburgerVariants.line3} transition={{ duration: 0.2 }} />
            </motion.div>
          )}
        </nav>
      </div>

      <AnimatePresence>
        {isMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeMenu}
              className="mobile-menu-overlay"
              aria-hidden="true"
            />
            
            <motion.div
              variants={dropdownVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
              className="mobile-menu-dropdown"
              role="menu"
            >
              <ul className="dropdown-list" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {navLinks.map((link) => {
                  const isActive = location.pathname === link.to;
                  return (
                    <li key={link.to} style={{ listStyle: 'none' }} role="none">
                      <Link 
                        to={link.to} 
                        onClick={closeMenu} 
                        className={`dropdown-link ${isActive ? 'active-page' : ''}`}
                        role="menuitem"
                      >
                        <link.icon size={18} /> 
                        <span>{link.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </header>
  );
};

export default Navbar;