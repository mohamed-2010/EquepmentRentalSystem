import {
  LayoutDashboard,
  Package,
  Users,
  FileText,
  Building2,
  LogOut,
  Wrench,
  DollarSign,
  Calendar,
  CalendarDays,
} from "lucide-react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";

const menuItems = [
  { title: "لوحة التحكم", url: "/dashboard", icon: LayoutDashboard },
  { title: "المعدات", url: "/equipment", icon: Package },
  { title: "العملاء", url: "/customers", icon: Users },
  { title: "الإيجارات اليومية", url: "/rentals/daily", icon: Calendar },
  { title: "الإيجارات الشهرية", url: "/rentals/monthly", icon: CalendarDays },
  { title: "الصيانة", url: "/maintenance", icon: Wrench },
  { title: "المصروفات", url: "/expenses", icon: DollarSign },
  { title: "الفروع", url: "/branches", icon: Building2 },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const collapsed = state === "collapsed";

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  return (
    <Sidebar collapsible="icon" side="right">
      <SidebarContent>
        <div className="p-4 flex items-center gap-2">
          <Package className="h-8 w-8 text-sidebar-foreground" />
          {!collapsed && (
            <div>
              <h2 className="text-lg font-bold text-sidebar-foreground">
                نظام الإيجار
              </h2>
              <p className="text-xs text-sidebar-foreground/80">
                إدارة المعدات
              </p>
            </div>
          )}
        </div>

        <SidebarGroup>
          <SidebarGroupLabel className={collapsed ? "sr-only" : ""}>
            القائمة الرئيسية
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end
                      className={({ isActive }) =>
                        isActive
                          ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                          : "hover:bg-sidebar-accent/50 text-sidebar-foreground"
                      }
                    >
                      <item.icon className="h-5 w-5" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <Button
          variant="ghost"
          onClick={handleSignOut}
          className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent"
        >
          <LogOut className="h-5 w-5" />
          {!collapsed && <span>تسجيل الخروج</span>}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
