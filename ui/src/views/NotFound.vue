<template>
    <div class="content">
      <p>The page you are looking for does not exist.</p>
      <router-link to="/" class="home-link">Go Home</router-link>
    </div>
</template>

<script>
export default {
  name: 'NotFound'
};
</script>

<style scoped>
.not-found {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 80vh;
  text-align: center;
}

.content {
  max-width: 500px;
}

h1 {
  color: #dc3545;
  margin: 0 0 20px 0;
}

h2 {
  color: #333;
  margin: 0 0 20px 0;
}

p {
  color: #666;
  margin: 0 0 30px 0;
}

.home-link {
  padding: 12px 24px;
  background: #007bff;
  color: white;
  text-decoration: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.home-link:hover {
  background: #0056b3;
  text-decoration: none;
  color: white;
}
</style>
