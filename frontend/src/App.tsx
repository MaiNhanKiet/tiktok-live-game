import { Route, Routes } from "react-router-dom";
import { Toaster } from "sonner";
import Dashboard from "./pages/Dashboard";
import LandingPage from "./pages/LandingPage";
import Login from "./pages/Login";
import Register from "./pages/Register";
import BlockClickGame from "./pages/BlockClickGame";
import BlockClickDisplay from "./pages/BlockClickDisplay";
import CarRaceGame from "./pages/CarRaceGame";
import CarRaceDisplay from "./pages/CarRaceDisplay";
import BalloonGame from "./pages/BalloonGame";
import BalloonDisplay from "./pages/BalloonDisplay";

function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/game/block-click" element={<BlockClickGame />} />
        {/* Public display page — no auth, use for OBS Browser Source */}
        <Route path="/game/block-click/display" element={<BlockClickDisplay />} />
        <Route path="/game/car-race" element={<CarRaceGame />} />
        <Route path="/game/car-race/display" element={<CarRaceDisplay />} />
        <Route path="/game/balloon" element={<BalloonGame />} />
        <Route path="/game/balloon/display" element={<BalloonDisplay />} />
      </Routes>
      <Toaster position="bottom-right" richColors />
    </>
  );
}

export default App;
