const getConfig = () => {
  const envBackendUrl = import.meta.env.VITE_BACKEND_URL;

  return {
    API_BASE_URL: envBackendUrl,
  };
};

const config = getConfig();

export default config;
