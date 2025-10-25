import { useState, useEffect } from "react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { getAllFromLocal, saveToLocal } from "@/lib/offline/db";
import { addToQueue } from "@/lib/offline/queue";
import { getOfflineUser } from "@/lib/offline/offlineAuth";

interface Customer {
  id: string;
  full_name: string;
  phone: string;
  id_number?: string;
}

interface CustomerAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onCustomerAdded?: () => void;
}

export function CustomerAutocomplete({
  value,
  onChange,
  onCustomerAdded,
}: CustomerAutocompleteProps) {
  const [open, setOpen] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newCustomer, setNewCustomer] = useState({
    full_name: "",
    phone: "",
    id_number: "",
    notes: "",
  });
  const { toast } = useToast();
  const isOnline = useOnlineStatus();

  useEffect(() => {
    loadCustomers();
  }, [isOnline]);

  const loadCustomers = async () => {
    try {
      if (isOnline) {
        // Load from Supabase when online
        const { data } = await supabase
          .from("customers")
          .select("id, full_name, phone, id_number")
          .order("full_name");
        if (data) setCustomers(data);
      } else {
        // Load from IndexedDB when offline
        console.log("[CustomerAutocomplete] Loading from IndexedDB");
        const data = await getAllFromLocal("customers");
        setCustomers(data as Customer[]);
      }
    } catch (error) {
      console.error("Error loading customers:", error);
      toast({
        title: "خطأ",
        description: "فشل تحميل العملاء",
        variant: "destructive",
      });
    }
  };

  const handleAddCustomer = async () => {
    try {
      // Resolve branch_id without forcing online calls
      const resolveBranchId = async (): Promise<string | null> => {
        // 1) sessionStorage offline_session
        try {
          const ss = sessionStorage.getItem("offline_session");
          if (ss) {
            const sess = JSON.parse(ss);
            if (sess?.user_metadata?.branch_id)
              return sess.user_metadata.branch_id as string;
          }
        } catch {}

        // 2) localStorage user_role
        try {
          const ur = localStorage.getItem("user_role");
          if (ur) {
            const parsed = JSON.parse(ur);
            if (parsed?.branch_id) return parsed.branch_id as string;
          }
        } catch {}

        // 3) offline user
        const offline = getOfflineUser();
        if (offline?.branch_id) return offline.branch_id;

        // 4) legacy key
        const legacy = localStorage.getItem("user_branch_id");
        if (legacy) return legacy;

        // 5) As a last step, if online, try Supabase quickly with timeout
        if (isOnline) {
          try {
            const {
              data: { user },
            } = await supabase.auth.getUser();
            if (!user) return null;
            const timeoutMs = 2000;
            const fetchPromise = supabase
              .from("user_roles")
              .select("branch_id")
              .eq("user_id", user.id)
              .limit(1)
              .maybeSingle();
            const timeoutPromise = new Promise<{ data: any | null }>(
              (resolve) => setTimeout(() => resolve({ data: null }), timeoutMs)
            );
            const { data } = await Promise.race([fetchPromise, timeoutPromise]);
            if (data?.branch_id) {
              try {
                localStorage.setItem("user_role", JSON.stringify(data));
              } catch {}
              try {
                localStorage.setItem("user_branch_id", data.branch_id);
              } catch {}
              return data.branch_id as string;
            }
          } catch {}
        }

        return null;
      };

      const branchId = await resolveBranchId();
      if (!branchId) {
        toast({
          title: "خطأ",
          description:
            "لم يتم تحديد الفرع للمستخدم (وضع Offline). سجّل دخولاً مرة عبر الإنترنت أولاً.",
          variant: "destructive",
        });
        return;
      }

      const customerData = {
        ...newCustomer,
        branch_id: branchId,
        id: crypto.randomUUID(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        synced: false,
      };

      if (isOnline) {
        // Online: Save to Supabase
        const { data, error } = await supabase
          .from("customers")
          .insert({
            ...newCustomer,
            branch_id: branchId,
          })
          .select()
          .single();

        if (error) throw error;

        toast({
          title: "تم بنجاح",
          description: "تمت إضافة العميل بنجاح",
        });

        await loadCustomers();
        onChange(data.id);
      } else {
        // Offline: Save to IndexedDB and queue
        await saveToLocal("customers", customerData);
        await addToQueue("customers", "insert", customerData);

        toast({
          title: "تم بنجاح (Offline)",
          description:
            "تمت إضافة العميل محلياً. سيتم المزامنة عند عودة الاتصال.",
        });

        await loadCustomers();
        onChange(customerData.id);
      }

      setIsAddDialogOpen(false);
      setNewCustomer({ full_name: "", phone: "", id_number: "", notes: "" });
      onCustomerAdded?.();
    } catch (error: any) {
      toast({
        title: "خطأ",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const selectedCustomer = customers.find((c) => c.id === value);
  const filteredCustomers = customers.filter(
    (c) =>
      c.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.phone.includes(searchQuery) ||
      (c.id_number && c.id_number.includes(searchQuery))
  );

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between"
          >
            {selectedCustomer ? (
              <span>
                {selectedCustomer.full_name} - {selectedCustomer.phone}
              </span>
            ) : (
              "ابحث عن عميل..."
            )}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0">
          <Command>
            <CommandInput
              placeholder="ابحث بالاسم أو الهاتف..."
              value={searchQuery}
              onValueChange={setSearchQuery}
            />
            <CommandList>
              <CommandEmpty>
                <div className="p-4 text-center">
                  <p className="text-sm text-muted-foreground mb-2">
                    لا يوجد عملاء
                  </p>
                  <Button
                    size="sm"
                    onClick={() => {
                      setOpen(false);
                      setIsAddDialogOpen(true);
                    }}
                    className="gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    إضافة عميل جديد
                  </Button>
                </div>
              </CommandEmpty>
              <CommandGroup>
                <CommandItem
                  onSelect={() => {
                    setOpen(false);
                    setIsAddDialogOpen(true);
                  }}
                  className="gap-2"
                >
                  <Plus className="h-4 w-4" />
                  إضافة عميل جديد
                </CommandItem>
                {filteredCustomers.map((customer) => (
                  <CommandItem
                    key={customer.id}
                    value={customer.id}
                    onSelect={(currentValue) => {
                      onChange(currentValue === value ? "" : currentValue);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "ml-2 h-4 w-4",
                        value === customer.id ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <div>
                      <div className="font-medium">{customer.full_name}</div>
                      <div className="text-sm text-muted-foreground">
                        {customer.phone}
                      </div>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>إضافة عميل جديد</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>الاسم الكامل *</Label>
              <Input
                value={newCustomer.full_name}
                onChange={(e) =>
                  setNewCustomer({ ...newCustomer, full_name: e.target.value })
                }
                placeholder="أدخل الاسم الكامل"
              />
            </div>
            <div className="space-y-2">
              <Label>رقم الهاتف *</Label>
              <Input
                value={newCustomer.phone}
                onChange={(e) =>
                  setNewCustomer({ ...newCustomer, phone: e.target.value })
                }
                placeholder="05xxxxxxxx"
              />
            </div>
            <div className="space-y-2">
              <Label>رقم الهوية</Label>
              <Input
                value={newCustomer.id_number}
                onChange={(e) =>
                  setNewCustomer({ ...newCustomer, id_number: e.target.value })
                }
                placeholder="1xxxxxxxxx"
              />
            </div>
            <div className="space-y-2">
              <Label>ملاحظات</Label>
              <Textarea
                value={newCustomer.notes}
                onChange={(e) =>
                  setNewCustomer({ ...newCustomer, notes: e.target.value })
                }
                placeholder="ملاحظات إضافية"
                rows={3}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => setIsAddDialogOpen(false)}
              >
                إلغاء
              </Button>
              <Button
                onClick={handleAddCustomer}
                disabled={!newCustomer.full_name || !newCustomer.phone}
              >
                حفظ
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
