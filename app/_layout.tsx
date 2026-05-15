import { Stack } from 'expo-router';
import 'react-native-reanimated';

export default function RootLayout() {
  return (
    // 使用 Stack 而不是 Tabs，這樣就不會有底部的按鈕列
    <Stack>
      <Stack.Screen 
        name="index" 
        options={{ 
          title: '首頁', // 這裡可以設定頂部標題
          headerShown: false // 如果完全不需要頂部標題列，可以設為 false
        }} 
      />
    </Stack>
  );
}