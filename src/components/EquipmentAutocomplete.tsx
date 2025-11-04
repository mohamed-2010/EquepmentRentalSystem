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
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { getAllFromLocal } from "@/lib/offline/db";

interface Equipment {
  id: string;
  name: string;
  code: string;
  daily_rate: number;
  status: string;
}

interface EquipmentAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  availableOnly?: boolean;
}

export function EquipmentAutocomplete({
  value,
  onChange,
  availableOnly = true,
}: EquipmentAutocompleteProps) {
  const [open, setOpen] = useState(false);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const isOnline = useOnlineStatus();

  useEffect(() => {
    loadEquipment();
  }, [availableOnly, isOnline]);

  const loadEquipment = async () => {
    try {
      if (isOnline) {
        // Load from Supabase when online
        let query = supabase
          .from("equipment")
          .select("id, name, code, daily_rate, status")
          .order("name");

        // if (availableOnly) {
        //   query = query.eq("status", "available");
        // }

        const { data } = await query;
        if (data) setEquipment(data);
      } else {
        // Load from IndexedDB when offline
        console.log("[EquipmentAutocomplete] Loading from IndexedDB");
        const data = await getAllFromLocal("equipment");
        let filteredData = data as Equipment[];

        // if (availableOnly) {
        //   filteredData = filteredData;
        // }

        setEquipment(filteredData);
      }
    } catch (error) {
      console.error("Error loading equipment:", error);
    }
  };

  const selectedEquipment = equipment.find((e) => e.id === value);
  const filteredEquipment = equipment.filter(
    (e) =>
      e.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
        >
          {selectedEquipment ? (
            <span>
              {selectedEquipment.name} - {selectedEquipment.code} (
              {selectedEquipment.daily_rate} ريال/يوم)
            </span>
          ) : (
            "ابحث عن معدة..."
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0">
        <Command>
          <CommandInput
            placeholder="ابحث بالاسم أو الكود..."
            value={searchQuery}
            onValueChange={setSearchQuery}
          />
          <CommandList>
            <CommandEmpty>
              لا توجد معدات {availableOnly && "متاحة"}
            </CommandEmpty>
            <CommandGroup>
              {filteredEquipment.map((item) => (
                <CommandItem
                  key={item.id}
                  value={item.id}
                  onSelect={(currentValue) => {
                    onChange(currentValue === value ? "" : currentValue);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "ml-2 h-4 w-4",
                      value === item.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <div className="flex-1">
                    <div className="font-medium">{item.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {item.code} - {item.daily_rate} ريال/يوم
                    </div>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
