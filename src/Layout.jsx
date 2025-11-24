import React from "react";
import { Link, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { BarChart3, Users, SlidersHorizontal, MessageCircle, Package, TrendingUp, MapPin } from "lucide-react"; // Added MapPin
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";

const navigationItems = [
  {
    title: "Operasyon Paneli",
    url: createPageUrl("Dashboard"),
    icon: BarChart3,
  },
  {
    title: "Sipariş Yönetimi",
    url: createPageUrl("OrderManagement"),
    icon: Package,
  },
  {
    title: "Manuel Atama",
    url: createPageUrl("ManualAssignment"),
    icon: SlidersHorizontal,
  },
  {
    title: "Sürücü Yönetimi",
    url: createPageUrl("DriverManagement"),
    icon: Users,
  },
  {
    title: "Top Dasher Haritası",
    url: createPageUrl("TopDasherMap"),
    icon: MapPin,
  },
  {
    title: "Konuşma Paneli",
    url: createPageUrl("ChatInterface"),
    icon: MessageCircle,
  },
  {
    title: "Ayarlar",
    url: createPageUrl("Settings"),
    icon: SlidersHorizontal,
  },
];

export default function Layout({ children, currentPageName }) {
  const location = useLocation();

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <Sidebar>
          <SidebarHeader className="p-4">
            <h2 className="text-lg font-semibold">Destek Asistanı</h2>
          </SidebarHeader>
          
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>Menü</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {navigationItems.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton 
                        asChild 
                        isActive={location.pathname === item.url}
                      >
                        <Link to={item.url} className="flex items-center gap-2">
                          <item.icon className="w-4 h-4" />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
        </Sidebar>

        <main className="flex-1 flex flex-col">
          <header className="border-b p-4 md:hidden">
            <div className="flex items-center gap-4">
              <SidebarTrigger />
              <h1 className="text-lg font-semibold">Destek Asistanı</h1>
            </div>
          </header>

          <div className="flex-1 overflow-auto">
            {children}
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}