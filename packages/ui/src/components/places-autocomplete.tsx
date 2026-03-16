import { APIProvider, useMapsLibrary } from "@vis.gl/react-google-maps";
import { MapPin, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Input } from "./input";

export interface PlaceResult {
  googlePlaceId: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  city: string | null;
  state: string | null;
  zip: string | null;
  website: string | null;
  phone: string | null;
}

interface PlacesAutocompleteProps {
  apiKey: string;
  value: PlaceResult | null;
  onChange: (place: PlaceResult | null) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function PlacesAutocomplete(props: PlacesAutocompleteProps) {
  if (!props.apiKey) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-600">
        Google Maps API key not configured.
      </div>
    );
  }

  return (
    <APIProvider apiKey={props.apiKey} libraries={["places"]}>
      <PlacesAutocompleteInner {...props} />
    </APIProvider>
  );
}

function extractAddressComponent(
  components: google.maps.GeocoderAddressComponent[] | undefined,
  type: string,
  useShortName = false,
): string | null {
  if (!components) return null;
  const comp = components.find((c) => c.types.includes(type));
  if (!comp) return null;
  return useShortName ? comp.short_name : comp.long_name;
}

function PlacesAutocompleteInner({
  value,
  onChange,
  placeholder = "Search for a venue...",
  disabled,
}: PlacesAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const placesLibrary = useMapsLibrary("places");
  const [autocomplete, setAutocomplete] = useState<google.maps.places.Autocomplete | null>(null);
  const [displayValue, setDisplayValue] = useState(value?.name ?? "");

  // Sync display when value changes externally
  const [prevValue, setPrevValue] = useState(value);
  if (value !== prevValue) {
    setPrevValue(value);
    setDisplayValue(value ? value.name || value.address : "");
  }

  // Initialize autocomplete
  useEffect(() => {
    if (!placesLibrary || !inputRef.current) return;

    const ac = new placesLibrary.Autocomplete(inputRef.current, {
      fields: [
        "place_id",
        "name",
        "formatted_address",
        "geometry",
        "address_components",
        "website",
        "formatted_phone_number",
      ],
    });

    setAutocomplete(ac);
  }, [placesLibrary]);

  // Listen for place selection
  useEffect(() => {
    if (!autocomplete) return;

    const listener = autocomplete.addListener("place_changed", () => {
      const place = autocomplete.getPlace();
      if (!place.geometry?.location || !place.place_id) return;

      const result: PlaceResult = {
        googlePlaceId: place.place_id,
        name: place.name ?? "",
        address: place.formatted_address ?? "",
        lat: place.geometry.location.lat(),
        lng: place.geometry.location.lng(),
        city: extractAddressComponent(place.address_components, "locality"),
        state: extractAddressComponent(
          place.address_components,
          "administrative_area_level_1",
          true,
        ),
        zip: extractAddressComponent(place.address_components, "postal_code"),
        website: place.website ?? null,
        phone: place.formatted_phone_number ?? null,
      };

      setDisplayValue(result.name || result.address);
      onChange(result);
    });

    return () => {
      google.maps.event.removeListener(listener);
    };
  }, [autocomplete, onChange]);

  function handleClear() {
    setDisplayValue("");
    onChange(null);
    if (inputRef.current) {
      inputRef.current.value = "";
      inputRef.current.focus();
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <div className="text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2">
          <MapPin className="size-4" />
        </div>
        <Input
          ref={inputRef}
          type="text"
          value={displayValue}
          onChange={(e) => setDisplayValue(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className={`pl-9 ${value ? "pr-9" : ""}`}
          autoComplete="off"
        />
        {value && (
          <button
            type="button"
            onClick={handleClear}
            className="text-muted-foreground hover:text-foreground absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
          >
            <X className="size-4" />
          </button>
        )}
      </div>
      {value && (
        <div className="text-muted-foreground text-xs">
          <p className="text-foreground text-sm font-medium">{value.name}</p>
          <p>{value.address}</p>
        </div>
      )}
    </div>
  );
}
