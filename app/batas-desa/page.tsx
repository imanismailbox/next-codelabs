"use client";

import React, { useEffect, useRef, useCallback } from "react";
import "ol/ol.css";
import Map from "ol/Map";
import View from "ol/View";
import { fromLonLat } from "ol/proj";
import VectorTileLayer from "ol/layer/VectorTile";
import VectorTileSource from "ol/source/VectorTile";
import MVT from "ol/format/MVT";
import { Fill, Stroke, Style } from "ol/style";
import { useState } from "react";
import TileLayer from "ol/layer/Tile";
import OSM from "ol/source/OSM";
import { FeatureLike } from "ol/Feature";
import { MapBrowserEvent } from "ol";

export interface IResponse {
  status: boolean;
  data: IDesa;
}

export interface IDesa {
  id: number;
  kode_desa: string;
  namobj: string;
  fcode: string;
  remark: string;
  metadata: string;
  srs_id: string;
  kdbbps: string;
  kdcbps: string;
  kdcpum: string;
  kdebps: string;
  kdepum: string;
  kdpbps: string;
  kdpkab: string;
  kdppum: string;
  luaswh: number;
  tipadm: number;
  wadmkc: string;
  wadmkd: string;
  wadmkk: string;
  wadmpr: string;
  wiadkc: string;
  wiadkd: string;
  wiadkk: string;
  wiadpr: string;
  uupp: string;
  shape_leng: number;
  shape_area: number;
  lon: number;
  lat: number;
  geom: IGeom;
  area_km2: string;
}

export interface IGeom {
  type: string;
  coordinates: Array<Array<Array<number[]>>>;
}

export default function BatasDesaPage() {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<Map | null>(null);
  const vectorLayerRef = useRef<VectorTileLayer | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<IDesa[]>([]);
  const [selectedDesaId, setSelectedDesaId] = useState<number>(0);
  const [detailedInfo, setDetailedInfo] = useState<IDesa | null>(null);
  const [showDetailPanel, setShowDetailPanel] = useState(false);

  const handleSearch = useCallback(async () => {
    if (query.length < 2) return;
    try {
      const res = await fetch(
        `http://localhost/api/v1/desa/search?q=${encodeURIComponent(query)}`
      );
      const data = await res.json();

      if (Array.isArray(data)) {
        setResults(data);
      } else if (
        data &&
        typeof data === "object" &&
        Array.isArray(data.results)
      ) {
        setResults(data.results);
      } else {
        console.error("API response is not an array:", data);
        setResults([]);
      }
    } catch (error) {
      console.error("Error searching for desa:", error);
      setResults([]);
    }
  }, [query]);

  const fetchDesaDetail = useCallback(async (kode_desa: string) => {
    try {
      const res = await fetch(
        `http://localhost/api/v1/desa/detail/${kode_desa}`
      );
      const data = await res.json();
      setDetailedInfo(data.data);
      setShowDetailPanel(true);
    } catch (error) {
      console.error("Error fetching desa details:", error);
      setDetailedInfo(null);
    }
  }, []);

  const flyTo = useCallback(
    (lon: number, lat: number, desaId: number, kodeDesa: string) => {
      if (!mapInstanceRef.current) return;
      const coord = fromLonLat([lon, lat]);
      mapInstanceRef.current
        .getView()
        .animate({ center: coord, zoom: 14, duration: 1000 });

      setSelectedDesaId(desaId);
      fetchDesaDetail(kodeDesa);
    },
    [fetchDesaDetail]
  );

  // Create style function
  const createStyleFunction = useCallback((currentSelectedId: number) => {
    return (feature: FeatureLike) => {
      const featureId = feature.getProperties().id;

      const defaultStyle = new Style({
        stroke: new Stroke({
          color: "#0077cc",
          width: 1,
        }),
        fill: new Fill({
          color: "rgba(0, 119, 204, 0.1)",
        }),
      });

      const selectedStyle = new Style({
        stroke: new Stroke({
          color: "#ff0000",
          width: 2,
        }),
        fill: new Fill({
          color: "rgba(255, 0, 0, 0.2)",
        }),
      });

      return featureId === currentSelectedId ? selectedStyle : defaultStyle;
    };
  }, []);

  // Initialize map only once
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const osmLayer = new TileLayer({
      source: new OSM(),
    });

    const vectorTileLayer = new VectorTileLayer({
      source: new VectorTileSource({
        format: new MVT(),
        url: "http://localhost/api/v1/tiles/batas_desa/{z}/{x}/{y}.pbf",
      }),
      opacity: 0.5,
      style: createStyleFunction(selectedDesaId),
    });

    vectorLayerRef.current = vectorTileLayer;

    const map = new Map({
      target: mapRef.current,
      layers: [osmLayer, vectorTileLayer],
      view: new View({
        center: fromLonLat([110.3695, -7.7956]),
        zoom: 5,
      }),
    });

    mapInstanceRef.current = map;

    const handleMoveEnd = () => {
      const center = map.getView().getCenter();
      if (!center) return;

      const pixel = map.getPixelFromCoordinate(center);

      let found = false;
      map.forEachFeatureAtPixel(
        pixel,
        (feature) => {
          const props = feature.getProperties();
          setInfo(
            `Desa: ${props.namobj ?? "Tidak diketahui"} (${props.wadmkc},
            ${props.wadmkk}, ${props.wadmpr})`
          );
          // console.log("Feature properties:", props);
          found = true;
          return true;
        },
        {
          hitTolerance: 5,
          layerFilter: (layer) => layer === vectorTileLayer,
        }
      );

      if (!found) {
        setInfo("Tidak ada desa di tengah peta");
      }
    };

    // Handle click on map to get feature info
    const handleMapClick = (event: MapBrowserEvent) => {
      const pixel = map.getEventPixel(event.originalEvent);

      map.forEachFeatureAtPixel(
        pixel,
        (feature) => {
          const props = feature.getProperties();
          const desaId = props.id;
          const kodeDesa = props.kdepum;
          console.log("Clicked feature properties:", props);
          if (desaId) {
            flyTo(props.lon, props.lat, desaId, kodeDesa);
          }

          return true;
        },
        {
          hitTolerance: 5,
          layerFilter: (layer) => layer === vectorTileLayer,
        }
      );
    };

    map.on("moveend", handleMoveEnd);
    map.on("click", handleMapClick);

    return () => {
      map.setTarget(undefined);
      mapInstanceRef.current = null;
      vectorLayerRef.current = null;
    };
  }, []); // Empty dependency array means this only runs once

  // Update style when selectedDesaId changes
  useEffect(() => {
    if (vectorLayerRef.current) {
      vectorLayerRef.current.setStyle(createStyleFunction(selectedDesaId));
    }
  }, [selectedDesaId, createStyleFunction]);

  // Format field labels for better display
  const formatFieldLabel = (field: string): string => {
    const labelMap: Record<string, string> = {
      id: "ID",
      kode_desa: "Kode Desa",
      namobj: "Nama Desa",
      fcode: "Kode Fitur",
      remark: "Keterangan",
      metadata: "Metadata",
      srs_id: "SRS ID",
      kdbbps: "Kode BPS",
      kdcbps: "Kode CBPS",
      kdcpum: "Kode CPUM",
      kdebps: "Kode EBPS",
      kdepum: "Kode EPUM",
      kdpbps: "Kode PBPS",
      kdpkab: "Kode PKAB",
      kdppum: "Kode PPUM",
      luaswh: "Luas (Ha)",
      tipadm: "Tipe Administrasi",
      wadmkc: "Kecamatan",
      wadmkd: "Desa/Kelurahan",
      wadmkk: "Kabupaten/Kota",
      wadmpr: "Provinsi",
      wiadkc: "Kode Kecamatan",
      wiadkk: "Kode Kabupaten",
      wiadpr: "Kode Provinsi",
      wiadkd: "Kode Desa",
      uupp: "UUPP",
      shape_leng: "Panjang Bentuk",
      shape_area: "Luas Bentuk",
    };

    return labelMap[field] || field;
  };

  return (
    <div className="w-full h-screen relative">
      <div ref={mapRef} className="w-full h-full" />

      {/* Search panel */}
      <div className="absolute top-4 right-4 w-64 bg-white text-black p-3 rounded shadow z-10">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          placeholder="Cari nama atau kode desa..."
          className="w-full border p-1 mb-2 text-sm"
        />
        <button
          onClick={handleSearch}
          className="bg-blue-500 text-white px-2 py-1 rounded text-sm w-full mb-2"
        >
          Cari
        </button>
        <ul className="max-h-40 overflow-y-auto text-sm">
          {Array.isArray(results) &&
            results.map((item) => (
              <li
                key={item.id}
                className="cursor-pointer hover:bg-gray-100 p-1 rounded"
                onClick={() => {
                  flyTo(item.lon, item.lat, item.id, item.kdepum);
                  setResults([]);
                  setQuery(item.namobj);
                }}
              >
                {/* {item.namobj} */}
                {item.wadmkd}, {item.wadmkc}, {item.wadmkk}, {item.wadmpr}
              </li>
            ))}
        </ul>
      </div>

      {/* Info panel */}
      <div className="absolute top-2 left-8 bg-white text-black bg-opacity-90 text-sm px-4 py-2 rounded shadow">
        {info ?? "Geser peta untuk melihat nama desa di tengah."}
      </div>

      {/* Detailed info panel */}
      {showDetailPanel && detailedInfo && (
        <div className="absolute bottom-4 left-4 right-4 bg-white text-black p-4 rounded shadow z-10 max-h-80 overflow-y-auto">
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-bold text-lg">
              {detailedInfo.namobj || "Detail Desa"}
            </h3>
            <button
              onClick={() => setShowDetailPanel(false)}
              className="text-gray-500 hover:text-gray-700"
            >
              ✕
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(detailedInfo)
              .filter(
                ([key]) =>
                  !["geom", "created_at", "updated_at"].includes(key) &&
                  detailedInfo[key as keyof IDesa] !== null
              )
              .map(([key, value]) => (
                <div key={key} className="border-b pb-1">
                  <span className="font-semibold">
                    {formatFieldLabel(key)}:{" "}
                  </span>
                  <span>{String(value)}</span>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
