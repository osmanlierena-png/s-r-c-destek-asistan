import Dashboard from './pages/Dashboard';
import DriverManagement from './pages/DriverManagement';
import Settings from './pages/Settings';
import ChatInterface from './pages/ChatInterface';
import OrderManagement from './pages/OrderManagement';
import DriverOrderView from './pages/DriverOrderView';
import AssignmentEvaluation from './pages/AssignmentEvaluation';
import WeeklyAnalysis from './pages/WeeklyAnalysis';
import RealAssignmentAnalysis from './pages/RealAssignmentAnalysis';
import DriverRegionAnalysis from './pages/DriverRegionAnalysis';
import TopDasherMap from './pages/TopDasherMap';
import LearningInsights from './pages/LearningInsights';
import InteractiveAssignment from './pages/InteractiveAssignment';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Dashboard": Dashboard,
    "DriverManagement": DriverManagement,
    "Settings": Settings,
    "ChatInterface": ChatInterface,
    "OrderManagement": OrderManagement,
    "DriverOrderView": DriverOrderView,
    "AssignmentEvaluation": AssignmentEvaluation,
    "WeeklyAnalysis": WeeklyAnalysis,
    "RealAssignmentAnalysis": RealAssignmentAnalysis,
    "DriverRegionAnalysis": DriverRegionAnalysis,
    "TopDasherMap": TopDasherMap,
    "LearningInsights": LearningInsights,
    "InteractiveAssignment": InteractiveAssignment,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};