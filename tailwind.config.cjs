module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./app/**/*.{js,ts,jsx,tsx}",
    "./node_modules/@shadcn/ui/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#1a202c", // Adjust the color to match your theme
          light: "#2d3748",
          dark: "#121923",
        },
      },
      fontFamily: {
        sans: ["Inter", "sans-serif"], // Add custom fonts
      },
    },
  },
  plugins: [],
};
