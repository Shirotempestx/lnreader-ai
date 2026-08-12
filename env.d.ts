declare module '@env' {
  // Named exports (for the Anime trackers)
  export const ANILIST_CLIENT_ID: string;
  export const MYANIMELIST_CLIENT_ID: string;

  // The default Config object (for the About page and everything else)
  const Config: {
    GIT_HASH: string;
    RELEASE_DATE: string;
    BUILD_TYPE: string;
    [key: string]: string; // This line tells TS to accept ANY future variables without complaining
  };

  export default Config;
}
