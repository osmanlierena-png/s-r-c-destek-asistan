/**
 * pages.config.js - Page routing configuration
 * 
 * This file is AUTO-GENERATED. Do not add imports or modify PAGES manually.
 * Pages are auto-registered when you create files in the ./pages/ folder.
 * 
 * THE ONLY EDITABLE VALUE: mainPage
 * This controls which page is the landing page (shown when users visit the app).
 * 
 * Example file structure:
 * 
 *   import HomePage from './pages/HomePage';
 *   import Dashboard from './pages/Dashboard';
 *   import Settings from './pages/Settings';
 *   
 *   export const PAGES = {
 *       "HomePage": HomePage,
 *       "Dashboard": Dashboard,
 *       "Settings": Settings,
 *   }
 *   
 *   export const pagesConfig = {
 *       mainPage: "HomePage",
 *       Pages: PAGES,
 *   };
 * 
 * Example with Layout (wraps all pages):
 *
 *   import Home from './pages/Home';
 *   import Settings from './pages/Settings';
 *   import __Layout from './Layout.jsx';
 *
 *   export const PAGES = {
 *       "Home": Home,
 *       "Settings": Settings,
 *   }
 *
 *   export const pagesConfig = {
 *       mainPage: "Home",
 *       Pages: PAGES,
 *       Layout: __Layout,
 *   };
 *
 * To change the main page from HomePage to Dashboard, use find_replace:
 *   Old: mainPage: "HomePage",
 *   New: mainPage: "Dashboard",
 *
 * The mainPage value must match a key in the PAGES object exactly.
 */
import AssignmentEvaluation from './pages/AssignmentEvaluation';
import ChatInterface from './pages/ChatInterface';
import Dashboard from './pages/Dashboard';
import DriverManagement from './pages/DriverManagement';
import DriverOrderView from './pages/DriverOrderView';
import DriverRegionAnalysis from './pages/DriverRegionAnalysis';
import Home from './pages/Home';
import LearningInsights from './pages/LearningInsights';
import OrderManagement from './pages/OrderManagement';
import RealAssignmentAnalysis from './pages/RealAssignmentAnalysis';
import Settings from './pages/Settings';
import TopDasherMap from './pages/TopDasherMap';
import WeeklyAnalysis from './pages/WeeklyAnalysis';
import __Layout from './Layout.jsx';


export const PAGES = {
    "AssignmentEvaluation": AssignmentEvaluation,
    "ChatInterface": ChatInterface,
    "Dashboard": Dashboard,
    "DriverManagement": DriverManagement,
    "DriverOrderView": DriverOrderView,
    "DriverRegionAnalysis": DriverRegionAnalysis,
    "Home": Home,
    "LearningInsights": LearningInsights,
    "OrderManagement": OrderManagement,
    "RealAssignmentAnalysis": RealAssignmentAnalysis,
    "Settings": Settings,
    "TopDasherMap": TopDasherMap,
    "WeeklyAnalysis": WeeklyAnalysis,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};