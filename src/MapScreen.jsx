import React, { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import supabase from './supabase.js';
import "./MapScreen.css";



// Custom marker icons
const soldierIcon = new L.Icon({
  iconUrl: "https://cdn-icons-png.flaticon.com/512/149/149071.png",
  iconSize: [25, 25],
  iconAnchor: [12, 25],
});

const enemyIcon = new L.Icon({
  iconUrl: "https://cdn-icons-png.flaticon.com/512/149/149076.png",
  iconSize: [25, 25],
  iconAnchor: [12, 25],
});

const MapScreen = () => {
  const [soldiers, setSoldiers] = useState([]);
  const [enemies, setEnemies] = useState([]);
  const [selectedPosition, setSelectedPosition] = useState(null);
  const [isAddingEnemy, setIsAddingEnemy] = useState(false); // Toggle for enemy addition mode

  // Fetch initial data
  const fetchData = async () => {
    try {
      const { data: soldiersData, error: soldiersError } = await supabase
        .from("soldiers")
        .select("*");
      if (soldiersError) throw soldiersError;

      const { data: enemiesData, error: enemiesError } = await supabase
        .from("enemies")
        .select("*");
      if (enemiesError) throw enemiesError;

      setSoldiers(soldiersData || []);
      setEnemies(enemiesData || []);
    } catch (error) {
console.error("Error fetching data:", error.message);
    }
  };

  // Add an enemy at the selected position
  const addEnemy = async (position) => {
    try {
      const { lat, lng } = position;
      const { data, error } = await supabase
        .from("enemies")
        .insert([{ name: "Enemy", latitude: lat, longitude: lng }])
        .single();
      if (error) throw error;

      console.log("Enemy added:", data);
      setEnemies((prev) => [...prev, data]); // Add enemy to state
    } catch (error) {
      console.error("Error adding enemy:", error.message);
    }
  };

  // Remove an enemy by ID
  const removeEnemy = async (id) => {
    try {
      const { error } = await supabase.from("enemies").delete().eq("id", id);
      if (error) throw error;

      setEnemies((prev) => prev.filter((enemy) => enemy.id !== id));
    } catch (error) {
      console.error("Error removing enemy:", error.message);
    }
  };

  // Subscribe to real-time updates
  const setupRealtimeSubscriptions = () => {
    const soldiersChannel = supabase
      .channel("soldiers-updates")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "soldiers" },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setSoldiers((prev) => [...prev, payload.new]);
          } else if (payload.eventType === "UPDATE") {
            setSoldiers((prev) =>
              prev.map((soldier) =>
                soldier.id === payload.new.id ? payload.new : soldier
              )
            );
          } else if (payload.eventType === "DELETE") {
            setSoldiers((prev) =>
              prev.filter((soldier) => soldier.id !== payload.old.id)
            );
          }
        }
      )
      .subscribe();

    const enemiesChannel = supabase
      .channel("enemies-updates")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "enemies" },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setEnemies((prev) => [...prev, payload.new]);
          } else if (payload.eventType === "UPDATE") {
            setEnemies((prev) =>
              prev.map((enemy) =>
                enemy.id === payload.new.id ? payload.new : enemy
              )
            );
          } else if (payload.eventType === "DELETE") {
            setEnemies((prev) =>
              prev.filter((enemy) => enemy.id !== payload.old.id)
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(soldiersChannel);
      supabase.removeChannel(enemiesChannel);
    };
  };

  // Map click handler for adding enemy
  const MapClickHandler = () => {
    useMapEvents({
      click: (e) => {
        if (isAddingEnemy) {
          const { lat, lng } = e.latlng;
          setSelectedPosition({ lat, lng });
          addEnemy({ lat, lng }); // Add enemy at clicked location
          setIsAddingEnemy(false); // Disable enemy addition mode
        }
      },
    });
    return null;
  };

  useEffect(() => {
    fetchData(); // Fetch initial data
    const cleanup = setupRealtimeSubscriptions(); // Setup subscriptions
    return cleanup; // Clean up on unmount
  }, []);

  return (
    <div className="map-screen">
      {/* Map */}
      <MapContainer center={[48.7363, 19.1461]} zoom={8} className="map-container">
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        <MapClickHandler />

        {/* Soldier Markers */}
        {soldiers.map((soldier) => (
          <Marker
            key={soldier.id}
            position={[soldier.latitude, soldier.longitude]}
            icon={soldierIcon}
          />
        ))}

        {/* Enemy Markers */}
        {enemies.map((enemy) => (
          <Marker
            key={enemy.id}
            position={[enemy.latitude, enemy.longitude]}
            icon={enemyIcon}
          />
        ))}

        {/* Selected Position Marker */}
        {selectedPosition && isAddingEnemy && (
          <Marker
            position={[selectedPosition.lat, selectedPosition.lng]}
            icon={enemyIcon}
          />
        )}
      </MapContainer>

      {/* Sidebar */}
      <div className="sidebar">
        <button
          className="add-enemy-button"
          onClick={() => setIsAddingEnemy(true)}
        >
          Add Enemy
        </button>

        {/* Enemy List */}
        <div className="enemy-list">
          <h3>Enemies</h3>
          {enemies.map((enemy) => (
            <div key={enemy.id} className="enemy-item">
              <span>{enemy.name}</span>
              <button
                className="remove-button"
                onClick={() => removeEnemy(enemy.id)}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default MapScreen;

