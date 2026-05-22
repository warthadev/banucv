import React from "react";
import { motion } from "framer-motion";
import { 
  FiSmartphone, FiCode, FiShield, FiLink, 
  FiZap, FiCpu, FiMaximize, FiMoon, FiUser
} from "react-icons/fi";
import { GithubIcon, GoogleIcon, YahooIcon } from "@/react/control/icon";
import { heroVariants, gridVariants, cardVariants, socialIconVariants } from "@/react/animation/home";


interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  children?: React.ReactNode;
}

const FeatureCard: React.FC<FeatureCardProps> = ({ icon, title, description, children }) => (
  <motion.div 
    variants={cardVariants}
    whileHover={{ y: -5, transition: { duration: 0.2 } }}
    className="home-card"
  >
    <div className="card-header">
      <div className="card-icon-wrapper">{icon}</div>
      <h3 className="home-card-title">{title}</h3>
    </div>
    {children}
    <p className="home-card-text">{description}</p>
  </motion.div>
);

const Home: React.FC = () => {
  const currentYear = new Date().getFullYear();

  const features = [
    { icon: <FiSmartphone size={22} />, title: "Mobile First", description: "Optimized for high performance mobile hardware with a minimalist software footprint" },
    { icon: <FiZap size={22} />, title: "Supported High Speed", description: "Experience lightning fast Hot Module Replacement for near instant development cycles" },
    { icon: <FiCode size={22} />, title: "Clean Architecture", description: "Modular code structure using centralized routing and advanced directory mapping" },
    { icon: <FiMaximize size={22} />, title: "Fully Responsive", description: "Seamless layout transitions engineered for Desktop Tablet and Android displays" },
    { icon: <FiUser size={22} />, title: "User Friendly", description: "Expertly crafted for a seamless experience a website built entirely through AI assistance" },
    { icon: <FiMoon size={22} />, title: "Adaptive Theming", description: "Auto detects system preferences to switch between elegant Dark and Light modes" },
    { icon: <FiShield size={22} />, title: "Advanced Security", description: "Robust data protection featuring secure dashboard routes and token based validation" },
    { icon: <FiCpu size={22} />, title: "Low Overhead", description: "Sustainably engineered to maximize performance while minimizing CPU and RAM usage" }
  ];

  return (
    <div className="home-container">
      <main className="home-hero">
        <motion.div
          variants={heroVariants}
          initial="initial"
          animate="animate"
          style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}
        >
          <h1 className="home-title">Development Environment</h1>
          <p className="home-subtitle">
            Built entirely on Android via Termux and Acode enhanced by AI 
            Powered by React 19 and Vite for a cutting edge experience
          </p>
        </motion.div>

        <motion.div 
          className="home-grid"
          variants={gridVariants}
          initial="hidden"
          animate="visible"
        >
          {features.map((item, index) => (
            <FeatureCard 
              key={index}
              icon={item.icon}
              title={item.title}
              description={item.description}
            />
          ))}

          <FeatureCard 
            icon={<FiLink size={22} />} 
            title="Quick Connect"
            description="Securely authenticate through official identity providers in a single tap"
          >
            <div className="social-wrapper">
              <motion.div variants={socialIconVariants} whileHover="hover" whileTap="tap"><YahooIcon /></motion.div>
              <motion.div variants={socialIconVariants} whileHover="hover" whileTap="tap"><GithubIcon /></motion.div>
              <motion.div variants={socialIconVariants} whileHover="hover" whileTap="tap"><GoogleIcon /></motion.div>
            </div>
          </FeatureCard>
        </motion.div>
      </main>

      <footer className="home-footer">
        <p>© {currentYear} WarthaDev • Engineering with Passion</p>
      </footer>
    </div>
  );
};

export default Home;
