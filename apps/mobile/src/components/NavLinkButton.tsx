import { Link, type Href } from "expo-router";
import { StyleSheet, Text } from "react-native";

interface NavLinkButtonProps {
  href: Href;
  label: string;
  /** Visually secondary (outlined) vs. the default filled/primary style. */
  variant?: "primary" | "secondary";
  testID?: string;
}

/** Small shared tappable link (e.g. Login <-> Register, Dashboard -> dev status). */
export function NavLinkButton({ href, label, variant = "primary", testID }: NavLinkButtonProps) {
  return (
    <Link href={href} testID={testID} style={[styles.link, variant === "secondary" && styles.linkSecondary]}>
      <Text style={[styles.label, variant === "secondary" && styles.labelSecondary]}>{label}</Text>
    </Link>
  );
}

const styles = StyleSheet.create({
  link: {
    backgroundColor: "#2f6f4f",
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    textAlign: "center",
  },
  linkSecondary: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "#2f6f4f",
  },
  label: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
  },
  labelSecondary: {
    color: "#2f6f4f",
  },
});
