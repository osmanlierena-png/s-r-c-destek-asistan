import AssignmentEvaluation from './pages/AssignmentEvaluation';
import ChatInterface from './pages/ChatInterface';
import Dashboard from './pages/Dashboard';
import DriverManagement from './pages/DriverManagement';
import DriverOrderView from './pages/DriverOrderView';
import DriverRegionAnalysis from './pages/DriverRegionAnalysis';
import Home from './pages/Home';
import InteractiveAssignment from './pages/InteractiveAssignment';
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
    "InteractiveAssignment": InteractiveAssignment,
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