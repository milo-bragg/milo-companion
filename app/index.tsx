/**
 * Entry point — redirects to the main tabs.
 */
import { Redirect } from 'expo-router';

export default function Index() {
  return <Redirect href="/(tabs)/chat" />;
}
