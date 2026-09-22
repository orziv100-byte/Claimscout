package main

import (
	"os/exec"
)

func main() {
	_ = exec.Command("cmd", "/c", "start", "", "https://poolindex.app/wallet").Run()
}
