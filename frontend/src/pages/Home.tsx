import { Box, CircularProgress } from "@mui/material";
import React, { useEffect } from "react";
import {
  getAllLibraries,
  getLibraryDir,
  getLibraryMeta,
  getLibrarySecondary,
} from "../plex";
import { shuffleArray } from "../common/ArrayExtra";
import MovieItemSlider from "../components/MovieItemSlider";
import HeroDisplay from "../components/HeroDisplay";
import { useUserSettings } from "../states/UserSettingsState";

export default function Home() {
  const [libraries, setLibraries] = React.useState<Plex.LibarySection[]>([]);
  const [featured, setFeatured] = React.useState<
    PerPlexed.RecommendationShelf[]
  >([]);
  const [randomItem, setRandomItem] = React.useState<Plex.Metadata | null>(
    null
  );
  const { settings, loaded: settingsLoaded } = useUserSettings();

  const [loading, setLoading] = React.useState(true);

  useEffect(() => {
    if (!settingsLoaded) return;

    async function fetchData() {
      setLoading(true);
      try {
        const librariesData = await getAllLibraries();

        const enabledLibraries = librariesData.filter((library) => {
          const key = `LIBRARY_${library.uuid}`;
          const value = settings[key];
          return value === undefined || value === "true"; // Default to true
        });
        setLibraries(enabledLibraries);

        const filteredLibraries = enabledLibraries
          .filter((lib) => ["movie", "show"].includes(lib.type))
          .slice(0, 4); // limit to first 4 libraries

        const featuredData = await getRecommendations(filteredLibraries);
        setFeatured(featuredData);

        let randomItemData = await getRandomItem(filteredLibraries);
        let attempts = 0;
        while (!randomItemData && attempts < 15) {
          randomItemData = await getRandomItem(filteredLibraries);
          attempts++;
        }

        if (!randomItemData) return;

        const data = await getLibraryMeta(randomItemData?.ratingKey as string);
        setRandomItem(data);
      } catch (error) {
        console.error("Error fetching data", error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [settings]);

  if (loading)
    return (
      <Box
        sx={{
          width: "100vw",
          height: "80vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <CircularProgress />
      </Box>
    );

  return (
    <Box
      className="app-page"
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "stretch",
        justifyContent: "flex-start",
        position: "relative",
        gap: { xs: 6, md: 8 },
      }}
    >
      <Box
        sx={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          zIndex: 0,
          background:
            "radial-gradient(circle at 18% 0%, rgba(80, 70, 225, 0.18), transparent 45%), radial-gradient(circle at 82% 8%, rgba(122, 112, 255, 0.14), transparent 45%)",
        }}
      />
      <Box
        sx={{
          position: "relative",
          zIndex: 1,
          display: "flex",
          flexDirection: "column",
          gap: { xs: 6, md: 8 },
        }}
      >
      {randomItem && <HeroDisplay item={randomItem} />}
      <Box
        sx={{
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "flex-start",
          gap: { xs: 6, md: 8 },
          pb: { xs: 6, md: 8 },
          mt: randomItem ? { xs: 2, md: 4 } : 0,
        }}
      >
        <MovieItemSlider
          title="Continue Watching"
          dir="/library/onDeck"
          link="/library/onDeck"
        />

        {featured &&
          featured.map((item, index) => (
            <MovieItemSlider
              key={index}
              title={item.title}
              dir={item.dir}
              shuffle={true}
              link={item.link}
            />
          ))}
      </Box>
      </Box>
    </Box>
  );
}

async function getRecommendations(libraries: Plex.Directory[]) {
  const genreSelection: PerPlexed.RecommendationShelf[] = [];

  for (const library of libraries) {
    const genres = await getLibrarySecondary(library.key, "genre");

    if (!genres || !genres.length) continue;

    const selectGenres: Plex.Directory[] = [];

    // Get 5 random genres
    while (selectGenres.length < Math.min(5, genres.length)) {
      const genre = genres[Math.floor(Math.random() * genres.length)];
      if (selectGenres.includes(genre)) continue;
      selectGenres.push(genre);
    }

    for (const genre of selectGenres) {
      genreSelection.push({
        title: `${library.title} - ${genre.title}`,
        libraryID: library.key,
        dir: `/library/sections/${library.key}/genre/${genre.key}`,
        link: `/library/sections/${library.key}/genre/${genre.key}`,
      });
    }
  }

  return shuffleArray(genreSelection);
}

// get one completely random item from any library
async function getRandomItem(libraries: Plex.Directory[]) {
  try {
    const library = libraries[Math.floor(Math.random() * libraries.length)];

    const items = await getLibraryDir(`/library/sections/${library.key}/all`, {
      sort: "random:desc",
      limit: 1,
    });

    return items.Metadata?.[0] || null;
  } catch (error) {
    console.log("Error fetching random item", error);
    return null;
  }
}
